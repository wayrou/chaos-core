use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

type SharedWriter = Arc<Mutex<TcpStream>>;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RelayClientWireMessage {
    RegisterHost { join_code: String, peer_id: String },
    JoinLobby { join_code: String, peer_id: String },
    Relay {
        message_kind: String,
        payload: String,
        target_peer_id: Option<String>,
    },
    Disconnect,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RelayServerWireMessage {
    Registered { join_code: String, peer_id: String },
    Joined { join_code: String, peer_id: String, host_peer_id: String },
    PeerConnected { peer_id: String },
    PeerDisconnected { peer_id: String },
    Relay { source_peer_id: String, message_kind: String, payload: String },
    Error { message: String },
    RoomClosed,
}

#[derive(Clone)]
struct RelayMembership {
    join_code: String,
    is_host: bool,
}

struct RelayRoom {
    host_peer_id: String,
    host_writer: SharedWriter,
    peers: HashMap<String, SharedWriter>,
}

#[derive(Default)]
struct RelayState {
    rooms: HashMap<String, RelayRoom>,
    memberships: HashMap<String, RelayMembership>,
}

fn send_server_message(writer: &SharedWriter, message: &RelayServerWireMessage) {
    let serialized = match serde_json::to_string(message) {
        Ok(value) => value,
        Err(error) => {
            eprintln!("[relay] failed to encode server message: {}", error);
            return;
        }
    };

    if let Ok(mut guard) = writer.lock() {
        if guard.write_all(format!("{}\n", serialized).as_bytes()).is_ok() {
            let _ = guard.flush();
        }
    }
}

fn close_writer(writer: &SharedWriter) {
    if let Ok(guard) = writer.lock() {
        let _ = guard.shutdown(Shutdown::Both);
    }
}

fn remove_peer(state: &Arc<Mutex<RelayState>>, peer_id: &str) {
    let mut host_notify: Option<SharedWriter> = None;
    let mut room_closed_targets: Vec<SharedWriter> = Vec::new();

    if let Ok(mut guard) = state.lock() {
        let membership = match guard.memberships.remove(peer_id) {
            Some(value) => value,
            None => return,
        };

        if membership.is_host {
            if let Some(room) = guard.rooms.remove(&membership.join_code) {
                for connected_peer_id in room.peers.keys() {
                    guard.memberships.remove(connected_peer_id);
                }
                room_closed_targets = room.peers.values().cloned().collect();
            }
        } else if let Some(room) = guard.rooms.get_mut(&membership.join_code) {
            room.peers.remove(peer_id);
            host_notify = Some(room.host_writer.clone());
        }
    }

    if let Some(host_writer) = host_notify {
        send_server_message(
            &host_writer,
            &RelayServerWireMessage::PeerDisconnected {
                peer_id: peer_id.to_string(),
            },
        );
    }

    for writer in &room_closed_targets {
        send_server_message(writer, &RelayServerWireMessage::RoomClosed);
        close_writer(writer);
    }
}

fn handle_register_host(
    state: &Arc<Mutex<RelayState>>,
    writer: &SharedWriter,
    join_code: String,
    peer_id: String,
) -> Result<(), String> {
    let normalized_join_code = join_code.trim().to_uppercase();
    if normalized_join_code.is_empty() {
        return Err("Join code cannot be blank.".to_string());
    }

    let mut guard = state
        .lock()
        .map_err(|_| "Failed to access relay state.".to_string())?;

    if guard.rooms.contains_key(&normalized_join_code) {
        return Err(format!("Join code {} is already in use.", normalized_join_code));
    }

    guard.rooms.insert(
        normalized_join_code.clone(),
        RelayRoom {
            host_peer_id: peer_id.clone(),
            host_writer: writer.clone(),
            peers: HashMap::new(),
        },
    );
    guard.memberships.insert(
        peer_id.clone(),
        RelayMembership {
            join_code: normalized_join_code.clone(),
            is_host: true,
        },
    );

    send_server_message(
        writer,
        &RelayServerWireMessage::Registered {
            join_code: normalized_join_code,
            peer_id,
        },
    );
    Ok(())
}

fn handle_join_lobby(
    state: &Arc<Mutex<RelayState>>,
    writer: &SharedWriter,
    join_code: String,
    peer_id: String,
) -> Result<(), String> {
    let normalized_join_code = join_code.trim().to_uppercase();
    if normalized_join_code.is_empty() {
        return Err("Join code cannot be blank.".to_string());
    }

    let (host_writer, host_peer_id) = {
        let mut guard = state
            .lock()
            .map_err(|_| "Failed to access relay state.".to_string())?;
        let room = guard
            .rooms
            .get_mut(&normalized_join_code)
            .ok_or_else(|| format!("Join code {} is not registered.", normalized_join_code))?;
        room.peers.insert(peer_id.clone(), writer.clone());
        let host_writer = room.host_writer.clone();
        let host_peer_id = room.host_peer_id.clone();
        guard.memberships.insert(
            peer_id.clone(),
            RelayMembership {
                join_code: normalized_join_code.clone(),
                is_host: false,
            },
        );
        (host_writer, host_peer_id)
    };

    send_server_message(
        writer,
        &RelayServerWireMessage::Joined {
            join_code: normalized_join_code,
            peer_id: peer_id.clone(),
            host_peer_id,
        },
    );
    send_server_message(
        &host_writer,
        &RelayServerWireMessage::PeerConnected { peer_id },
    );
    Ok(())
}

fn handle_relay_message(
    state: &Arc<Mutex<RelayState>>,
    source_peer_id: &str,
    message_kind: String,
    payload: String,
    target_peer_id: Option<String>,
) -> Result<(), String> {
    let targets = {
        let guard = state
            .lock()
            .map_err(|_| "Failed to access relay state.".to_string())?;
        let membership = guard
            .memberships
            .get(source_peer_id)
            .ok_or_else(|| "Source peer is not registered in the relay.".to_string())?;
        let room = guard
            .rooms
            .get(&membership.join_code)
            .ok_or_else(|| "Relay room is no longer available.".to_string())?;

        if membership.is_host {
            if let Some(target) = target_peer_id.as_ref() {
                room.peers
                    .get(target)
                    .cloned()
                    .into_iter()
                    .collect::<Vec<_>>()
            } else {
                room.peers.values().cloned().collect::<Vec<_>>()
            }
        } else {
            vec![room.host_writer.clone()]
        }
    };

    for writer in &targets {
        send_server_message(
            writer,
            &RelayServerWireMessage::Relay {
                source_peer_id: source_peer_id.to_string(),
                message_kind: message_kind.clone(),
                payload: payload.clone(),
            },
        );
    }

    Ok(())
}

fn handle_connection(stream: TcpStream, state: Arc<Mutex<RelayState>>) {
    let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
    let writer = match stream.try_clone() {
        Ok(clone) => Arc::new(Mutex::new(clone)),
        Err(error) => {
            eprintln!("[relay] failed to clone stream: {}", error);
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

                match serde_json::from_str::<RelayClientWireMessage>(trimmed) {
                    Ok(RelayClientWireMessage::RegisterHost { join_code, peer_id }) => {
                        match handle_register_host(&state, &writer, join_code, peer_id.clone()) {
                            Ok(()) => registered_peer_id = Some(peer_id),
                            Err(message) => {
                                send_server_message(&writer, &RelayServerWireMessage::Error { message });
                                break;
                            }
                        }
                    }
                    Ok(RelayClientWireMessage::JoinLobby { join_code, peer_id }) => {
                        match handle_join_lobby(&state, &writer, join_code, peer_id.clone()) {
                            Ok(()) => registered_peer_id = Some(peer_id),
                            Err(message) => {
                                send_server_message(&writer, &RelayServerWireMessage::Error { message });
                                break;
                            }
                        }
                    }
                    Ok(RelayClientWireMessage::Relay {
                        message_kind,
                        payload,
                        target_peer_id,
                    }) => {
                        let Some(source_peer_id) = registered_peer_id.as_ref() else {
                            send_server_message(
                                &writer,
                                &RelayServerWireMessage::Error {
                                    message: "Register with the relay before sending payloads.".to_string(),
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
                            send_server_message(&writer, &RelayServerWireMessage::Error { message });
                            break;
                        }
                    }
                    Ok(RelayClientWireMessage::Disconnect) => break,
                    Err(error) => {
                        send_server_message(
                            &writer,
                            &RelayServerWireMessage::Error {
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
                eprintln!("[relay] stream error: {}", error);
                break;
            }
        }
    }

    if let Some(peer_id) = registered_peer_id.as_ref() {
        remove_peer(&state, peer_id);
    }
    close_writer(&writer);
}

fn main() {
    let bind_address = std::env::var("CHAOS_CORE_RELAY_BIND")
        .unwrap_or_else(|_| "0.0.0.0:4100".to_string());
    let listener = TcpListener::bind(&bind_address)
        .unwrap_or_else(|error| panic!("failed to bind relay at {}: {}", bind_address, error));
    let state = Arc::new(Mutex::new(RelayState::default()));

    println!("[relay] listening on {}", bind_address);

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let state = state.clone();
                thread::spawn(move || {
                    handle_connection(stream, state);
                });
            }
            Err(error) => {
                eprintln!("[relay] accept error: {}", error);
            }
        }
    }
}
