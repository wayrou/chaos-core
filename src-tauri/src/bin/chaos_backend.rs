use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

type SharedWriter = Arc<Mutex<TcpStream>>;

const JOIN_CODE_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum BackendClientWireMessage {
    CreateLobby {
        peer_id: String,
        callsign: Option<String>,
    },
    JoinLobby {
        join_code: String,
        peer_id: String,
        callsign: Option<String>,
    },
    Relay {
        message_kind: String,
        payload: String,
        target_peer_id: Option<String>,
    },
    Disconnect,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum BackendServerWireMessage {
    LobbyCreated {
        join_code: String,
        peer_id: String,
        callsign: Option<String>,
    },
    LobbyJoined {
        join_code: String,
        peer_id: String,
        host_peer_id: String,
        host_callsign: Option<String>,
    },
    PeerConnected {
        peer_id: String,
        callsign: Option<String>,
    },
    PeerDisconnected {
        peer_id: String,
        callsign: Option<String>,
    },
    Relay {
        source_peer_id: String,
        message_kind: String,
        payload: String,
    },
    Error {
        message: String,
    },
    LobbyClosed {
        join_code: String,
    },
}

#[derive(Clone)]
struct LobbyMembership {
    join_code: String,
    is_host: bool,
    callsign: Option<String>,
}

struct LobbyPeer {
    writer: SharedWriter,
}

struct LobbyRoom {
    host_peer_id: String,
    host_callsign: Option<String>,
    host_writer: SharedWriter,
    peers: HashMap<String, LobbyPeer>,
}

#[derive(Default)]
struct BackendState {
    lobbies: HashMap<String, LobbyRoom>,
    memberships: HashMap<String, LobbyMembership>,
}

fn normalize_callsign(value: Option<String>) -> Option<String> {
    value
        .map(|callsign| callsign.trim().to_string())
        .filter(|callsign| !callsign.is_empty())
}

fn send_server_message(writer: &SharedWriter, message: &BackendServerWireMessage) {
    let serialized = match serde_json::to_string(message) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("[backend] failed to encode server message: {}", error);
            return;
        }
    };

    if let Ok(mut guard) = writer.lock() {
        if guard
            .write_all(format!("{}\n", serialized).as_bytes())
            .is_ok()
        {
            let _ = guard.flush();
        }
    }
}

fn close_writer(writer: &SharedWriter) {
    if let Ok(guard) = writer.lock() {
        let _ = guard.shutdown(Shutdown::Both);
    }
}

fn next_join_code_candidate(counter: &AtomicU64, length: usize) -> String {
    let mut seed = counter.fetch_add(1, Ordering::SeqCst)
        ^ (SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64)
            .rotate_left(17);
    let mut code = String::with_capacity(length);

    for _ in 0..length {
        seed = seed
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        let index = (seed % JOIN_CODE_ALPHABET.len() as u64) as usize;
        code.push(JOIN_CODE_ALPHABET[index] as char);
    }

    code
}

fn generate_join_code(state: &BackendState, counter: &AtomicU64, length: usize) -> String {
    loop {
        let candidate = next_join_code_candidate(counter, length);
        if !state.lobbies.contains_key(&candidate) {
            return candidate;
        }
    }
}

fn remove_peer(state: &Arc<Mutex<BackendState>>, peer_id: &str) {
    let mut host_notify: Option<(SharedWriter, Option<String>)> = None;
    let mut room_closed_targets: Vec<SharedWriter> = Vec::new();
    let mut closed_join_code: Option<String> = None;

    if let Ok(mut guard) = state.lock() {
        let membership = match guard.memberships.remove(peer_id) {
            Some(value) => value,
            None => return,
        };

        if membership.is_host {
            if let Some(room) = guard.lobbies.remove(&membership.join_code) {
                for connected_peer_id in room.peers.keys() {
                    guard.memberships.remove(connected_peer_id);
                }
                closed_join_code = Some(membership.join_code);
                room_closed_targets = room.peers.into_values().map(|peer| peer.writer).collect();
            }
        } else if let Some(room) = guard.lobbies.get_mut(&membership.join_code) {
            room.peers.remove(peer_id);
            host_notify = Some((room.host_writer.clone(), membership.callsign.clone()));
        }
    }

    if let Some((host_writer, callsign)) = host_notify {
        send_server_message(
            &host_writer,
            &BackendServerWireMessage::PeerDisconnected {
                peer_id: peer_id.to_string(),
                callsign,
            },
        );
    }

    if let Some(join_code) = closed_join_code {
        for writer in &room_closed_targets {
            send_server_message(
                writer,
                &BackendServerWireMessage::LobbyClosed {
                    join_code: join_code.clone(),
                },
            );
            close_writer(writer);
        }
    }
}

fn handle_create_lobby(
    state: &Arc<Mutex<BackendState>>,
    writer: &SharedWriter,
    join_code_counter: &AtomicU64,
    join_code_length: usize,
    peer_id: String,
    callsign: Option<String>,
) -> Result<(), String> {
    let normalized_callsign = normalize_callsign(callsign);

    let join_code = {
        let mut guard = state
            .lock()
            .map_err(|_| "Failed to access backend state.".to_string())?;

        if guard.memberships.contains_key(&peer_id) {
            return Err("This peer already owns or joined a lobby.".to_string());
        }

        let join_code = generate_join_code(&guard, join_code_counter, join_code_length);
        guard.lobbies.insert(
            join_code.clone(),
            LobbyRoom {
                host_peer_id: peer_id.clone(),
                host_callsign: normalized_callsign.clone(),
                host_writer: writer.clone(),
                peers: HashMap::new(),
            },
        );
        guard.memberships.insert(
            peer_id.clone(),
            LobbyMembership {
                join_code: join_code.clone(),
                is_host: true,
                callsign: normalized_callsign.clone(),
            },
        );
        join_code
    };

    send_server_message(
        writer,
        &BackendServerWireMessage::LobbyCreated {
            join_code,
            peer_id,
            callsign: normalized_callsign,
        },
    );
    Ok(())
}

fn handle_join_lobby(
    state: &Arc<Mutex<BackendState>>,
    writer: &SharedWriter,
    join_code: String,
    peer_id: String,
    callsign: Option<String>,
    max_lobby_size: usize,
) -> Result<(), String> {
    let normalized_join_code = join_code.trim().to_uppercase();
    let normalized_callsign = normalize_callsign(callsign);
    if normalized_join_code.is_empty() {
        return Err("Join code cannot be blank.".to_string());
    }

    let (host_writer, host_peer_id, host_callsign) = {
        let mut guard = state
            .lock()
            .map_err(|_| "Failed to access backend state.".to_string())?;

        if guard.memberships.contains_key(&peer_id) {
            return Err("This peer already owns or joined a lobby.".to_string());
        }

        let room = guard
            .lobbies
            .get_mut(&normalized_join_code)
            .ok_or_else(|| format!("Join code {} is not active.", normalized_join_code))?;

        let current_size = room.peers.len() + 1;
        if current_size >= max_lobby_size {
            return Err(format!(
                "Lobby {} is full. Maximum size is {}.",
                normalized_join_code, max_lobby_size
            ));
        }

        room.peers.insert(
            peer_id.clone(),
            LobbyPeer {
                writer: writer.clone(),
            },
        );

        let host_writer = room.host_writer.clone();
        let host_peer_id = room.host_peer_id.clone();
        let host_callsign = room.host_callsign.clone();

        guard.memberships.insert(
            peer_id.clone(),
            LobbyMembership {
                join_code: normalized_join_code.clone(),
                is_host: false,
                callsign: normalized_callsign.clone(),
            },
        );

        (host_writer, host_peer_id, host_callsign)
    };

    send_server_message(
        writer,
        &BackendServerWireMessage::LobbyJoined {
            join_code: normalized_join_code.clone(),
            peer_id: peer_id.clone(),
            host_peer_id,
            host_callsign,
        },
    );
    send_server_message(
        &host_writer,
        &BackendServerWireMessage::PeerConnected {
            peer_id,
            callsign: normalized_callsign,
        },
    );

    Ok(())
}

fn handle_relay_message(
    state: &Arc<Mutex<BackendState>>,
    source_peer_id: &str,
    message_kind: String,
    payload: String,
    target_peer_id: Option<String>,
) -> Result<(), String> {
    let targets = {
        let guard = state
            .lock()
            .map_err(|_| "Failed to access backend state.".to_string())?;
        let membership = guard
            .memberships
            .get(source_peer_id)
            .ok_or_else(|| "Source peer is not registered in any lobby.".to_string())?;
        let room = guard
            .lobbies
            .get(&membership.join_code)
            .ok_or_else(|| "Lobby is no longer available.".to_string())?;

        if membership.is_host {
            if let Some(target) = target_peer_id.as_ref() {
                room.peers
                    .get(target)
                    .map(|peer| peer.writer.clone())
                    .into_iter()
                    .collect::<Vec<_>>()
            } else {
                room.peers
                    .values()
                    .map(|peer| peer.writer.clone())
                    .collect::<Vec<_>>()
            }
        } else {
            vec![room.host_writer.clone()]
        }
    };

    for writer in &targets {
        send_server_message(
            writer,
            &BackendServerWireMessage::Relay {
                source_peer_id: source_peer_id.to_string(),
                message_kind: message_kind.clone(),
                payload: payload.clone(),
            },
        );
    }

    Ok(())
}

fn handle_connection(
    stream: TcpStream,
    state: Arc<Mutex<BackendState>>,
    join_code_counter: Arc<AtomicU64>,
    join_code_length: usize,
    max_lobby_size: usize,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let writer = match stream.try_clone() {
        Ok(clone) => Arc::new(Mutex::new(clone)),
        Err(error) => {
            eprintln!("[backend] failed to clone stream: {}", error);
            return;
        }
    };
    let mut reader = BufReader::new(stream);
    let mut registered_peer_id: Option<String> = None;

    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }

                match serde_json::from_str::<BackendClientWireMessage>(trimmed) {
                    Ok(BackendClientWireMessage::CreateLobby { peer_id, callsign }) => {
                        match handle_create_lobby(
                            &state,
                            &writer,
                            &join_code_counter,
                            join_code_length,
                            peer_id.clone(),
                            callsign,
                        ) {
                            Ok(()) => registered_peer_id = Some(peer_id),
                            Err(message) => {
                                send_server_message(&writer, &BackendServerWireMessage::Error { message });
                                break;
                            }
                        }
                    }
                    Ok(BackendClientWireMessage::JoinLobby {
                        join_code,
                        peer_id,
                        callsign,
                    }) => match handle_join_lobby(
                        &state,
                        &writer,
                        join_code,
                        peer_id.clone(),
                        callsign,
                        max_lobby_size,
                    ) {
                        Ok(()) => registered_peer_id = Some(peer_id),
                        Err(message) => {
                            send_server_message(&writer, &BackendServerWireMessage::Error { message });
                            break;
                        }
                    },
                    Ok(BackendClientWireMessage::Relay {
                        message_kind,
                        payload,
                        target_peer_id,
                    }) => {
                        let Some(source_peer_id) = registered_peer_id.as_ref() else {
                            send_server_message(
                                &writer,
                                &BackendServerWireMessage::Error {
                                    message: "Create or join a lobby before sending payloads.".to_string(),
                                },
                            );
                            break;
                        };
                        if let Err(message) = handle_relay_message(
                            &state,
                            source_peer_id,
                            message_kind,
                            payload,
                            target_peer_id,
                        ) {
                            send_server_message(&writer, &BackendServerWireMessage::Error { message });
                            break;
                        }
                    }
                    Ok(BackendClientWireMessage::Disconnect) => break,
                    Err(error) => {
                        send_server_message(
                            &writer,
                            &BackendServerWireMessage::Error {
                                message: format!("Failed to decode client payload: {}", error),
                            },
                        );
                        break;
                    }
                }
            }
            Err(error)
                if error.kind() == std::io::ErrorKind::WouldBlock
                    || error.kind() == std::io::ErrorKind::TimedOut =>
            {
                continue;
            }
            Err(error) => {
                eprintln!("[backend] stream error: {}", error);
                break;
            }
        }
    }

    if let Some(peer_id) = registered_peer_id.as_ref() {
        remove_peer(&state, peer_id);
    }
    close_writer(&writer);
}

fn read_env_usize(key: &str, default: usize, min: usize, max: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .map(|value| value.clamp(min, max))
        .unwrap_or(default)
}

fn main() {
    let bind_address = std::env::var("CHAOS_CORE_BACKEND_BIND")
        .unwrap_or_else(|_| "0.0.0.0:4210".to_string());
    let join_code_length = read_env_usize("CHAOS_CORE_BACKEND_CODE_LENGTH", 6, 4, 8);
    let max_lobby_size = read_env_usize("CHAOS_CORE_BACKEND_MAX_LOBBY_SIZE", 8, 2, 32);
    let listener = TcpListener::bind(&bind_address)
        .unwrap_or_else(|error| panic!("failed to bind backend at {}: {}", bind_address, error));
    let state = Arc::new(Mutex::new(BackendState::default()));
    let join_code_counter = Arc::new(AtomicU64::new(1));

    println!(
        "[backend] listening on {} // code length {} // max lobby size {}",
        bind_address, join_code_length, max_lobby_size
    );

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let state = state.clone();
                let join_code_counter = join_code_counter.clone();
                thread::spawn(move || {
                    handle_connection(
                        stream,
                        state,
                        join_code_counter,
                        join_code_length,
                        max_lobby_size,
                    );
                });
            }
            Err(error) => {
                eprintln!("[backend] accept error: {}", error);
            }
        }
    }
}
