// ============================================================================
// CHAOS CORE - TAURI MAIN.RS
// src-tauri/src/main.rs
// Save/load/settings commands plus Squad online transport runtime
// ============================================================================

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::net::{Shutdown, TcpListener, TcpStream, UdpSocket};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};
use tauri::{command, AppHandle, Emitter, State};

const SQUAD_TRANSPORT_EVENT: &str = "squad-transport-event";

// ----------------------------------------------------------------------------
// SAVE DIRECTORY MANAGEMENT
// ----------------------------------------------------------------------------

fn get_save_dir() -> Result<PathBuf, String> {
    let proj_dirs = ProjectDirs::from("com", "ardcytech", "chaoscore")
        .ok_or("Could not determine project directories")?;

    let save_dir = proj_dirs.data_dir().join("saves");

    if !save_dir.exists() {
        fs::create_dir_all(&save_dir)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;
    }

    Ok(save_dir)
}

fn get_save_path(slot: &str) -> Result<PathBuf, String> {
    let save_dir = get_save_dir()?;
    Ok(save_dir.join(format!("{}.json", slot)))
}

fn get_settings_path() -> Result<PathBuf, String> {
    let proj_dirs = ProjectDirs::from("com", "ardcytech", "chaoscore")
        .ok_or("Could not determine project directories")?;

    let config_dir = proj_dirs.config_dir();

    if !config_dir.exists() {
        fs::create_dir_all(config_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    Ok(config_dir.join("settings.json"))
}

fn get_repo_root() -> Result<PathBuf, String> {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .ok_or_else(|| "Could not resolve the Chaos Core project root.".to_string())
}

fn get_generated_technica_root() -> Result<PathBuf, String> {
    Ok(get_repo_root()?
        .join("src")
        .join("content")
        .join("technica")
        .join("generated"))
}

fn normalize_generated_technica_content_type(content_type: &str) -> Result<&str, String> {
    match content_type {
        "dialogue"
        | "mail"
        | "chatter"
        | "quest"
        | "key_item"
        | "faction"
        | "map"
        | "field_enemy"
        | "npc"
        | "item"
        | "gear"
        | "card"
        | "fieldmod"
        | "unit"
        | "operation"
        | "class"
        | "codex" => Ok(content_type),
        _ => Err(format!(
            "Unsupported generated Technica content type '{}'.",
            content_type
        )),
    }
}

fn generated_technica_runtime_extension(content_type: &str) -> Result<&'static str, String> {
    match content_type {
        "dialogue" => Ok(".dialogue.json"),
        "mail" => Ok(".mail.json"),
        "chatter" => Ok(".chatter.json"),
        "quest" => Ok(".quest.json"),
        "key_item" => Ok(".key_item.json"),
        "faction" => Ok(".faction.json"),
        "map" => Ok(".fieldmap.json"),
        "field_enemy" => Ok(".field_enemy.json"),
        "npc" => Ok(".npc.json"),
        "item" => Ok(".item.json"),
        "gear" => Ok(".gear.json"),
        "card" => Ok(".card.json"),
        "fieldmod" => Ok(".fieldmod.json"),
        "unit" => Ok(".unit.json"),
        "operation" => Ok(".operation.json"),
        "class" => Ok(".class.json"),
        "codex" => Ok(".codex.json"),
        _ => Err(format!(
            "Unsupported generated Technica content type '{}'.",
            content_type
        )),
    }
}

fn read_text_file(path: PathBuf, label: &str) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|error| format!("Failed to read {} '{}': {}", label, path.display(), error))
}

// ----------------------------------------------------------------------------
// DATA STRUCTURES
// ----------------------------------------------------------------------------

#[derive(Serialize, Deserialize)]
pub struct SaveInfo {
    pub slot: String,
    pub timestamp: u64,
}

#[derive(Clone)]
struct SquadTransportManager {
    runtime: Arc<Mutex<SquadTransportRuntime>>,
}

impl Default for SquadTransportManager {
    fn default() -> Self {
        Self {
            runtime: Arc::new(Mutex::new(SquadTransportRuntime::default())),
        }
    }
}

#[derive(Default)]
struct SquadTransportRuntime {
    role: SquadTransportRoleRuntime,
    peer_nonce: Arc<AtomicU64>,
}

enum SquadTransportRoleRuntime {
    Idle,
    Host(HostTransportRuntime),
    Client(ClientTransportRuntime),
    RelayHost(RelayTransportRuntime),
    RelayClient(RelayTransportRuntime),
    BackendHost(BackendTransportRuntime),
    BackendClient(BackendTransportRuntime),
}

impl Default for SquadTransportRoleRuntime {
    fn default() -> Self {
        Self::Idle
    }
}

struct HostTransportRuntime {
    shutdown: Arc<AtomicBool>,
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<TcpStream>>>>>,
    port: u16,
    join_address: String,
    listen_address: String,
}

struct ClientTransportRuntime {
    shutdown: Arc<AtomicBool>,
    writer: Arc<Mutex<TcpStream>>,
    host_address: String,
}

struct RelayTransportRuntime {
    shutdown: Arc<AtomicBool>,
    writer: Arc<Mutex<TcpStream>>,
    relay_address: String,
    join_code: String,
    peer_id: String,
    connected_peer_ids: Arc<Mutex<Vec<String>>>,
}

struct BackendTransportRuntime {
    shutdown: Arc<AtomicBool>,
    writer: Arc<Mutex<TcpStream>>,
    backend_address: String,
    join_code: String,
    peer_id: String,
    connected_peer_ids: Arc<Mutex<Vec<String>>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SquadTransportStatus {
    active: bool,
    role: String,
    port: Option<u16>,
    join_address: Option<String>,
    host_address: Option<String>,
    peer_id: Option<String>,
    connected_peer_ids: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SquadTransportEvent {
    #[serde(rename = "type")]
    event_type: String,
    role: String,
    source_peer_id: Option<String>,
    message_kind: Option<String>,
    payload: Option<String>,
    detail: Option<String>,
    status: SquadTransportStatus,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SquadTransportWireMessage {
    kind: String,
    payload: String,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RelayClientWireMessage {
    RegisterHost {
        join_code: String,
        peer_id: String,
    },
    JoinLobby {
        join_code: String,
        peer_id: String,
    },
    Relay {
        message_kind: String,
        payload: String,
        target_peer_id: Option<String>,
    },
    Disconnect,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum RelayServerWireMessage {
    Registered {
        join_code: String,
        peer_id: String,
    },
    Joined {
        join_code: String,
        peer_id: String,
        host_peer_id: String,
    },
    PeerConnected {
        peer_id: String,
    },
    PeerDisconnected {
        peer_id: String,
    },
    Relay {
        source_peer_id: String,
        message_kind: String,
        payload: String,
    },
    Error {
        message: String,
    },
    RoomClosed,
}

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

#[derive(Serialize, Deserialize)]
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

// ----------------------------------------------------------------------------
// SQUAD ONLINE TRANSPORT HELPERS
// ----------------------------------------------------------------------------

fn detect_join_host() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .ok()
        .and_then(|socket| {
            let _ = socket.connect("8.8.8.8:80");
            socket.local_addr().ok()
        })
        .map(|addr| addr.ip().to_string())
        .filter(|ip| !ip.is_empty() && ip != "0.0.0.0")
        .unwrap_or_else(|| "127.0.0.1".to_string())
}

fn build_idle_transport_status() -> SquadTransportStatus {
    SquadTransportStatus {
        active: false,
        role: "idle".to_string(),
        port: None,
        join_address: None,
        host_address: None,
        peer_id: None,
        connected_peer_ids: Vec::new(),
    }
}

fn build_transport_status(runtime: &SquadTransportRuntime) -> SquadTransportStatus {
    match &runtime.role {
        SquadTransportRoleRuntime::Idle => build_idle_transport_status(),
        SquadTransportRoleRuntime::Host(host) => {
            let connected_peer_ids = host
                .connections
                .lock()
                .map(|connections| connections.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default();

            SquadTransportStatus {
                active: true,
                role: "host".to_string(),
                port: Some(host.port),
                join_address: Some(host.join_address.clone()),
                host_address: Some(host.listen_address.clone()),
                peer_id: None,
                connected_peer_ids,
            }
        }
        SquadTransportRoleRuntime::Client(client) => SquadTransportStatus {
            active: true,
            role: "client".to_string(),
            port: None,
            join_address: None,
            host_address: Some(client.host_address.clone()),
            peer_id: None,
            connected_peer_ids: Vec::new(),
        },
        SquadTransportRoleRuntime::RelayHost(host) => SquadTransportStatus {
            active: true,
            role: "host".to_string(),
            port: None,
            join_address: Some(host.join_code.clone()),
            host_address: Some(host.relay_address.clone()),
            peer_id: Some(host.peer_id.clone()),
            connected_peer_ids: host
                .connected_peer_ids
                .lock()
                .map(|peers| peers.clone())
                .unwrap_or_default(),
        },
        SquadTransportRoleRuntime::RelayClient(client) => SquadTransportStatus {
            active: true,
            role: "client".to_string(),
            port: None,
            join_address: Some(client.join_code.clone()),
            host_address: Some(client.relay_address.clone()),
            peer_id: Some(client.peer_id.clone()),
            connected_peer_ids: client
                .connected_peer_ids
                .lock()
                .map(|peers| peers.clone())
                .unwrap_or_default(),
        },
        SquadTransportRoleRuntime::BackendHost(host) => SquadTransportStatus {
            active: true,
            role: "host".to_string(),
            port: None,
            join_address: Some(host.join_code.clone()),
            host_address: Some(host.backend_address.clone()),
            peer_id: Some(host.peer_id.clone()),
            connected_peer_ids: host
                .connected_peer_ids
                .lock()
                .map(|peers| peers.clone())
                .unwrap_or_default(),
        },
        SquadTransportRoleRuntime::BackendClient(client) => SquadTransportStatus {
            active: true,
            role: "client".to_string(),
            port: None,
            join_address: Some(client.join_code.clone()),
            host_address: Some(client.backend_address.clone()),
            peer_id: Some(client.peer_id.clone()),
            connected_peer_ids: client
                .connected_peer_ids
                .lock()
                .map(|peers| peers.clone())
                .unwrap_or_default(),
        },
    }
}

fn current_transport_status(runtime: &Arc<Mutex<SquadTransportRuntime>>) -> SquadTransportStatus {
    runtime
        .lock()
        .map(|guard| build_transport_status(&guard))
        .unwrap_or_else(|_| build_idle_transport_status())
}

fn emit_transport_event(
    app: &AppHandle,
    runtime: &Arc<Mutex<SquadTransportRuntime>>,
    event_type: &str,
    source_peer_id: Option<String>,
    message_kind: Option<String>,
    payload: Option<String>,
    detail: Option<String>,
) {
    let status = current_transport_status(runtime);
    let event = SquadTransportEvent {
        event_type: event_type.to_string(),
        role: status.role.clone(),
        source_peer_id,
        message_kind,
        payload,
        detail,
        status,
    };
    let _ = app.emit(SQUAD_TRANSPORT_EVENT, event);
}

fn shutdown_stream(stream: &Arc<Mutex<TcpStream>>) {
    if let Ok(guard) = stream.lock() {
        let _ = guard.shutdown(Shutdown::Both);
    }
}

fn next_transport_peer_id(runtime: &Arc<Mutex<SquadTransportRuntime>>, prefix: &str) -> String {
    let next_nonce = runtime
        .lock()
        .map(|guard| guard.peer_nonce.fetch_add(1, Ordering::SeqCst))
        .unwrap_or_else(|_| 0);
    format!("{}-{:x}", prefix, next_nonce)
}

fn shutdown_transport_runtime(runtime: &mut SquadTransportRuntime) {
    match &runtime.role {
        SquadTransportRoleRuntime::Idle => {}
        SquadTransportRoleRuntime::Host(host) => {
            host.shutdown.store(true, Ordering::SeqCst);
            if let Ok(connections) = host.connections.lock() {
                for stream in connections.values() {
                    shutdown_stream(stream);
                }
            }
        }
        SquadTransportRoleRuntime::Client(client) => {
            client.shutdown.store(true, Ordering::SeqCst);
            shutdown_stream(&client.writer);
        }
        SquadTransportRoleRuntime::RelayHost(host) | SquadTransportRoleRuntime::RelayClient(host) => {
            host.shutdown.store(true, Ordering::SeqCst);
            let _ = send_relay_wire_message(&host.writer, &RelayClientWireMessage::Disconnect);
            shutdown_stream(&host.writer);
        }
        SquadTransportRoleRuntime::BackendHost(host)
        | SquadTransportRoleRuntime::BackendClient(host) => {
            host.shutdown.store(true, Ordering::SeqCst);
            let _ = send_backend_wire_message(&host.writer, &BackendClientWireMessage::Disconnect);
            shutdown_stream(&host.writer);
        }
    }
    runtime.role = SquadTransportRoleRuntime::Idle;
}

fn send_wire_message(stream: &Arc<Mutex<TcpStream>>, kind: &str, payload: &str) -> Result<(), String> {
    let wire_message = SquadTransportWireMessage {
        kind: kind.to_string(),
        payload: payload.to_string(),
    };
    let serialized =
        serde_json::to_string(&wire_message).map_err(|e| format!("Failed to encode transport payload: {}", e))?;

    let mut guard = stream
        .lock()
        .map_err(|_| "Failed to lock transport stream.".to_string())?;
    guard
        .write_all(format!("{}\n", serialized).as_bytes())
        .map_err(|e| format!("Failed to write transport payload: {}", e))?;
    guard
        .flush()
        .map_err(|e| format!("Failed to flush transport payload: {}", e))?;

    Ok(())
}

fn send_relay_wire_message(
    stream: &Arc<Mutex<TcpStream>>,
    message: &RelayClientWireMessage,
) -> Result<(), String> {
    let serialized =
        serde_json::to_string(message).map_err(|e| format!("Failed to encode relay payload: {}", e))?;

    let mut guard = stream
        .lock()
        .map_err(|_| "Failed to lock relay stream.".to_string())?;
    guard
        .write_all(format!("{}\n", serialized).as_bytes())
        .map_err(|e| format!("Failed to write relay payload: {}", e))?;
    guard
        .flush()
        .map_err(|e| format!("Failed to flush relay payload: {}", e))?;

    Ok(())
}

fn send_backend_wire_message(
    stream: &Arc<Mutex<TcpStream>>,
    message: &BackendClientWireMessage,
) -> Result<(), String> {
    let serialized =
        serde_json::to_string(message).map_err(|e| format!("Failed to encode backend payload: {}", e))?;

    let mut guard = stream
        .lock()
        .map_err(|_| "Failed to lock backend stream.".to_string())?;
    guard
        .write_all(format!("{}\n", serialized).as_bytes())
        .map_err(|e| format!("Failed to write backend payload: {}", e))?;
    guard
        .flush()
        .map_err(|e| format!("Failed to flush backend payload: {}", e))?;

    Ok(())
}

fn await_backend_handshake(
    stream: TcpStream,
    context: &str,
) -> Result<(TcpStream, BackendServerWireMessage), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    match reader.read_line(&mut line) {
        Ok(0) => Err(format!("Backend closed the connection during {}.", context)),
        Ok(_) => {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return Err(format!("Backend returned an empty handshake during {}.", context));
            }
            let message = serde_json::from_str::<BackendServerWireMessage>(trimmed)
                .map_err(|e| format!("Failed to decode backend handshake during {}: {}", context, e))?;
            let stream = reader.into_inner();
            let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
            Ok((stream, message))
        }
        Err(error) => Err(format!("Failed to read backend handshake during {}: {}", context, error)),
    }
}

fn resolve_backend_address(configured: Option<String>) -> Result<String, String> {
    let explicit = configured
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(value) = explicit {
        return Ok(value);
    }

    let env_value = std::env::var("CHAOS_CORE_MULTIPLAYER_BACKEND_ADDRESS")
        .ok()
        .or_else(|| std::env::var("CHAOS_CORE_BACKEND_ADDRESS").ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if let Some(value) = env_value {
        return Ok(value);
    }

    #[cfg(debug_assertions)]
    {
        return Ok("127.0.0.1:4210".to_string());
    }

    #[cfg(not(debug_assertions))]
    {
        Err("Multiplayer service is not configured for this build.".to_string())
    }
}

fn spawn_relay_reader_thread(
    app: AppHandle,
    runtime: Arc<Mutex<SquadTransportRuntime>>,
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
    connected_peer_ids: Arc<Mutex<Vec<String>>>,
) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);

        loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<RelayServerWireMessage>(trimmed) {
                        Ok(RelayServerWireMessage::Registered { .. })
                        | Ok(RelayServerWireMessage::Joined { .. }) => {}
                        Ok(RelayServerWireMessage::PeerConnected { peer_id }) => {
                            if let Ok(mut peers) = connected_peer_ids.lock() {
                                if !peers.iter().any(|existing| existing == &peer_id) {
                                    peers.push(peer_id.clone());
                                }
                            }
                            emit_transport_event(
                                &app,
                                &runtime,
                                "peer_connected",
                                Some(peer_id.clone()),
                                None,
                                None,
                                Some(format!("Peer {} joined the relay lobby.", peer_id)),
                            );
                        }
                        Ok(RelayServerWireMessage::PeerDisconnected { peer_id }) => {
                            if let Ok(mut peers) = connected_peer_ids.lock() {
                                peers.retain(|existing| existing != &peer_id);
                            }
                            emit_transport_event(
                                &app,
                                &runtime,
                                "peer_disconnected",
                                Some(peer_id.clone()),
                                None,
                                None,
                                Some(format!("Peer {} left the relay lobby.", peer_id)),
                            );
                        }
                        Ok(RelayServerWireMessage::Relay {
                            source_peer_id,
                            message_kind,
                            payload,
                        }) => emit_transport_event(
                            &app,
                            &runtime,
                            "message",
                            Some(source_peer_id),
                            Some(message_kind),
                            Some(payload),
                            None,
                        ),
                        Ok(RelayServerWireMessage::Error { message }) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some(message),
                            );
                            break;
                        }
                        Ok(RelayServerWireMessage::RoomClosed) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some("Relay room closed by the host.".to_string()),
                            );
                            break;
                        }
                        Err(error) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some(format!("Failed to decode relay payload: {}", error)),
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
                    emit_transport_event(
                        &app,
                        &runtime,
                        "error",
                        None,
                        None,
                        None,
                        Some(format!("Relay stream error: {}", error)),
                    );
                    break;
                }
            }
        }

        if let Ok(mut guard) = runtime.lock() {
            shutdown_transport_runtime(&mut guard);
        }
        emit_transport_event(
            &app,
            &runtime,
            "stopped",
            None,
            None,
            None,
            Some("Disconnected from relay transport.".to_string()),
        );
    });
}

fn spawn_backend_reader_thread(
    app: AppHandle,
    runtime: Arc<Mutex<SquadTransportRuntime>>,
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
    connected_peer_ids: Arc<Mutex<Vec<String>>>,
) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);

        loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<BackendServerWireMessage>(trimmed) {
                        Ok(BackendServerWireMessage::LobbyCreated { .. })
                        | Ok(BackendServerWireMessage::LobbyJoined { .. }) => {}
                        Ok(BackendServerWireMessage::PeerConnected { peer_id, callsign }) => {
                            if let Ok(mut peers) = connected_peer_ids.lock() {
                                if !peers.iter().any(|existing| existing == &peer_id) {
                                    peers.push(peer_id.clone());
                                }
                            }
                            emit_transport_event(
                                &app,
                                &runtime,
                                "peer_connected",
                                Some(peer_id.clone()),
                                None,
                                None,
                                Some(match callsign {
                                    Some(value) if !value.trim().is_empty() => {
                                        format!("{} joined the lobby.", value.trim())
                                    }
                                    _ => format!("Peer {} joined the lobby.", peer_id),
                                }),
                            );
                        }
                        Ok(BackendServerWireMessage::PeerDisconnected { peer_id, callsign }) => {
                            if let Ok(mut peers) = connected_peer_ids.lock() {
                                peers.retain(|existing| existing != &peer_id);
                            }
                            emit_transport_event(
                                &app,
                                &runtime,
                                "peer_disconnected",
                                Some(peer_id.clone()),
                                None,
                                None,
                                Some(match callsign {
                                    Some(value) if !value.trim().is_empty() => {
                                        format!("{} left the lobby.", value.trim())
                                    }
                                    _ => format!("Peer {} left the lobby.", peer_id),
                                }),
                            );
                        }
                        Ok(BackendServerWireMessage::Relay {
                            source_peer_id,
                            message_kind,
                            payload,
                        }) => emit_transport_event(
                            &app,
                            &runtime,
                            "message",
                            Some(source_peer_id),
                            Some(message_kind),
                            Some(payload),
                            None,
                        ),
                        Ok(BackendServerWireMessage::Error { message }) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some(message),
                            );
                            break;
                        }
                        Ok(BackendServerWireMessage::LobbyClosed { join_code }) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some(format!("Lobby {} was closed by the host.", join_code)),
                            );
                            break;
                        }
                        Err(error) => {
                            emit_transport_event(
                                &app,
                                &runtime,
                                "error",
                                None,
                                None,
                                None,
                                Some(format!("Failed to decode backend payload: {}", error)),
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
                    emit_transport_event(
                        &app,
                        &runtime,
                        "error",
                        None,
                        None,
                        None,
                        Some(format!("Backend link error: {}", error)),
                    );
                    break;
                }
            }
        }

        emit_transport_event(
            &app,
            &runtime,
            "stopped",
            None,
            None,
            None,
            Some("Backend transport stopped.".to_string()),
        );
    });
}

fn spawn_host_reader_thread(
    app: AppHandle,
    runtime: Arc<Mutex<SquadTransportRuntime>>,
    peer_id: String,
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<TcpStream>>>>>,
) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);

        loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<SquadTransportWireMessage>(trimmed) {
                        Ok(message) => emit_transport_event(
                            &app,
                            &runtime,
                            "message",
                            Some(peer_id.clone()),
                            Some(message.kind),
                            Some(message.payload),
                            None,
                        ),
                        Err(error) => emit_transport_event(
                            &app,
                            &runtime,
                            "error",
                            Some(peer_id.clone()),
                            None,
                            None,
                            Some(format!("Failed to decode peer payload: {}", error)),
                        ),
                    }
                }
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        || error.kind() == std::io::ErrorKind::TimedOut =>
                {
                    continue;
                }
                Err(error) => {
                    emit_transport_event(
                        &app,
                        &runtime,
                        "error",
                        Some(peer_id.clone()),
                        None,
                        None,
                        Some(format!("Peer stream error: {}", error)),
                    );
                    break;
                }
            }
        }

        if let Ok(mut guard) = connections.lock() {
            guard.remove(&peer_id);
        }
        emit_transport_event(
            &app,
            &runtime,
            "peer_disconnected",
            Some(peer_id.clone()),
            None,
            None,
            Some(format!("{} disconnected.", peer_id)),
        );
    });
}

fn spawn_host_accept_thread(
    app: AppHandle,
    runtime: Arc<Mutex<SquadTransportRuntime>>,
    listener: TcpListener,
    shutdown: Arc<AtomicBool>,
    connections: Arc<Mutex<HashMap<String, Arc<Mutex<TcpStream>>>>>,
    peer_nonce: Arc<AtomicU64>,
) {
    thread::spawn(move || loop {
        if shutdown.load(Ordering::SeqCst) {
            break;
        }

        match listener.accept() {
            Ok((stream, remote_addr)) => {
                let _ = stream.set_nodelay(true);
                let writer = match stream.try_clone() {
                    Ok(writer) => Arc::new(Mutex::new(writer)),
                    Err(error) => {
                        emit_transport_event(
                            &app,
                            &runtime,
                            "error",
                            None,
                            None,
                            None,
                            Some(format!("Failed to clone peer stream: {}", error)),
                        );
                        continue;
                    }
                };

                let peer_id = format!("peer_{:x}", peer_nonce.fetch_add(1, Ordering::SeqCst));
                if let Ok(mut guard) = connections.lock() {
                    guard.insert(peer_id.clone(), writer);
                }

                emit_transport_event(
                    &app,
                    &runtime,
                    "peer_connected",
                    Some(peer_id.clone()),
                    None,
                    None,
                    Some(format!("{} linked from {}", peer_id, remote_addr)),
                );

                spawn_host_reader_thread(
                    app.clone(),
                    runtime.clone(),
                    peer_id,
                    stream,
                    shutdown.clone(),
                    connections.clone(),
                );
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                emit_transport_event(
                    &app,
                    &runtime,
                    "error",
                    None,
                    None,
                    None,
                    Some(format!("Host accept loop failed: {}", error)),
                );
                break;
            }
        }
    });
}

fn spawn_client_reader_thread(
    app: AppHandle,
    runtime: Arc<Mutex<SquadTransportRuntime>>,
    stream: TcpStream,
    shutdown: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(250)));
        let mut reader = BufReader::new(stream);

        loop {
            if shutdown.load(Ordering::SeqCst) {
                break;
            }

            let mut line = String::new();
            match reader.read_line(&mut line) {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    match serde_json::from_str::<SquadTransportWireMessage>(trimmed) {
                        Ok(message) => emit_transport_event(
                            &app,
                            &runtime,
                            "message",
                            Some("host".to_string()),
                            Some(message.kind),
                            Some(message.payload),
                            None,
                        ),
                        Err(error) => emit_transport_event(
                            &app,
                            &runtime,
                            "error",
                            Some("host".to_string()),
                            None,
                            None,
                            Some(format!("Failed to decode host payload: {}", error)),
                        ),
                    }
                }
                Err(error)
                    if error.kind() == std::io::ErrorKind::WouldBlock
                        || error.kind() == std::io::ErrorKind::TimedOut =>
                {
                    continue;
                }
                Err(error) => {
                    emit_transport_event(
                        &app,
                        &runtime,
                        "error",
                        Some("host".to_string()),
                        None,
                        None,
                        Some(format!("Host stream error: {}", error)),
                    );
                    break;
                }
            }
        }

        if let Ok(mut guard) = runtime.lock() {
            shutdown_transport_runtime(&mut guard);
        }
        emit_transport_event(
            &app,
            &runtime,
            "stopped",
            Some("host".to_string()),
            None,
            None,
            Some("Disconnected from host transport.".to_string()),
        );
    });
}

// ----------------------------------------------------------------------------
// SAVE/LOAD COMMANDS
// ----------------------------------------------------------------------------

#[command]
fn save_game(slot: String, json: String) -> Result<(), String> {
    let save_path = get_save_path(&slot)?;

    fs::write(&save_path, &json).map_err(|e| format!("Failed to write save file: {}", e))?;

    println!("[SAVE] Game saved to slot: {}", slot);
    Ok(())
}

#[command]
fn load_game(slot: String) -> Result<String, String> {
    let save_path = get_save_path(&slot)?;

    if !save_path.exists() {
        return Err(format!("No save file found for slot: {}", slot));
    }

    let json =
        fs::read_to_string(&save_path).map_err(|e| format!("Failed to read save file: {}", e))?;

    println!("[LOAD] Game loaded from slot: {}", slot);
    Ok(json)
}

#[command]
fn has_save(slot: String) -> Result<bool, String> {
    let save_path = get_save_path(&slot)?;
    Ok(save_path.exists())
}

#[command]
fn delete_save(slot: String) -> Result<(), String> {
    let save_path = get_save_path(&slot)?;

    if save_path.exists() {
        fs::remove_file(&save_path).map_err(|e| format!("Failed to delete save file: {}", e))?;
        println!("[DELETE] Save deleted: {}", slot);
    }

    Ok(())
}

#[command]
fn list_saves() -> Result<Vec<SaveInfo>, String> {
    let save_dir = get_save_dir()?;
    let mut saves = Vec::new();

    if let Ok(entries) = fs::read_dir(&save_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "json") {
                if let Some(slot) = path.file_stem().and_then(|s| s.to_str()) {
                    let metadata = fs::metadata(&path).ok();
                    let modified = metadata
                        .and_then(|m| m.modified().ok())
                        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);

                    saves.push(SaveInfo {
                        slot: slot.to_string(),
                        timestamp: modified,
                    });
                }
            }
        }
    }

    saves.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(saves)
}

#[command]
fn get_save_info(slot: String) -> Result<SaveInfo, String> {
    let save_path = get_save_path(&slot)?;

    if !save_path.exists() {
        return Err(format!("No save file found for slot: {}", slot));
    }

    let metadata =
        fs::metadata(&save_path).map_err(|e| format!("Failed to read save metadata: {}", e))?;

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(SaveInfo { slot, timestamp: modified })
}

// ----------------------------------------------------------------------------
// SETTINGS COMMANDS
// ----------------------------------------------------------------------------

#[command]
fn save_settings(json: String) -> Result<(), String> {
    let settings_path = get_settings_path()?;

    fs::write(&settings_path, &json).map_err(|e| format!("Failed to write settings: {}", e))?;

    println!("[SETTINGS] Settings saved");
    Ok(())
}

#[command]
fn load_settings() -> Result<String, String> {
    let settings_path = get_settings_path()?;

    if !settings_path.exists() {
        return Err("No settings file found".to_string());
    }

    let json =
        fs::read_to_string(&settings_path).map_err(|e| format!("Failed to read settings: {}", e))?;

    println!("[SETTINGS] Settings loaded");
    Ok(json)
}

#[command]
fn read_generated_technica_version() -> Result<String, String> {
    read_text_file(
        get_generated_technica_root()?.join("version.json"),
        "generated Technica version marker",
    )
}

#[command]
fn read_generated_technica_registry() -> Result<String, String> {
    read_text_file(
        get_generated_technica_root()?.join("registry.json"),
        "generated Technica registry",
    )
}

#[command]
fn read_generated_technica_entry(content_type: String, content_id: String) -> Result<String, String> {
    let normalized_content_type = normalize_generated_technica_content_type(content_type.trim())?;
    let normalized_content_id = content_id.trim();
    if normalized_content_id.is_empty() {
        return Err("Generated Technica entry id cannot be empty.".to_string());
    }

    let runtime_extension = generated_technica_runtime_extension(normalized_content_type)?;
    let runtime_path = get_generated_technica_root()?
        .join(normalized_content_type)
        .join(format!("{}{}", normalized_content_id, runtime_extension));

    read_text_file(
        runtime_path,
        &format!(
            "generated Technica {} entry '{}'",
            normalized_content_type, normalized_content_id
        ),
    )
}

// ----------------------------------------------------------------------------
// SQUAD ONLINE TRANSPORT COMMANDS
// ----------------------------------------------------------------------------

#[command]
fn get_squad_transport_status(transport: State<SquadTransportManager>) -> SquadTransportStatus {
    current_transport_status(&transport.runtime)
}

#[command]
fn start_squad_transport_host(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    preferred_port: Option<u16>,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let listener = TcpListener::bind(("0.0.0.0", preferred_port.unwrap_or(0)))
        .map_err(|e| format!("Failed to bind Squad host transport: {}", e))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Failed to configure Squad host listener: {}", e))?;
    let listen_address = listener
        .local_addr()
        .map_err(|e| format!("Failed to resolve Squad host address: {}", e))?;
    let join_address = format!("{}:{}", detect_join_host(), listen_address.port());

    let shutdown = Arc::new(AtomicBool::new(false));
    let connections = Arc::new(Mutex::new(HashMap::new()));
    let peer_nonce = {
        let runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.peer_nonce.clone()
    };

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::Host(HostTransportRuntime {
            shutdown: shutdown.clone(),
            connections: connections.clone(),
            port: listen_address.port(),
            join_address: join_address.clone(),
            listen_address: listen_address.to_string(),
        });
    }

    spawn_host_accept_thread(
        app.clone(),
        transport.runtime.clone(),
        listener,
        shutdown,
        connections,
        peer_nonce,
    );

    emit_transport_event(
        &app,
        &transport.runtime,
        "host_started",
        None,
        None,
        None,
        Some(format!("Squad host transport ready at {}", join_address)),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn start_squad_transport_join(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    host_address: String,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let trimmed_host = host_address.trim().to_string();
    if trimmed_host.is_empty() {
        return Err("Enter a valid host address before joining.".to_string());
    }

    let stream = TcpStream::connect(&trimmed_host)
        .map_err(|e| format!("Failed to connect to Squad host {}: {}", trimmed_host, e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("Failed to configure client transport: {}", e))?;
    let writer = Arc::new(Mutex::new(
        stream
            .try_clone()
            .map_err(|e| format!("Failed to clone client transport stream: {}", e))?,
    ));
    let shutdown = Arc::new(AtomicBool::new(false));

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::Client(ClientTransportRuntime {
            shutdown: shutdown.clone(),
            writer: writer.clone(),
            host_address: trimmed_host.clone(),
        });
    }

    spawn_client_reader_thread(app.clone(), transport.runtime.clone(), stream, shutdown);

    emit_transport_event(
        &app,
        &transport.runtime,
        "client_connected",
        Some("host".to_string()),
        None,
        None,
        Some(format!("Linked to Squad host {}", trimmed_host)),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn start_squad_transport_relay_host(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    relay_address: String,
    join_code: String,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let trimmed_relay = relay_address.trim().to_string();
    if trimmed_relay.is_empty() {
        return Err("Enter a valid relay address before hosting.".to_string());
    }
    let trimmed_join_code = join_code.trim().to_uppercase();
    if trimmed_join_code.is_empty() {
        return Err("Enter a valid join code before hosting.".to_string());
    }

    let stream = TcpStream::connect(&trimmed_relay)
        .map_err(|e| format!("Failed to connect to relay {}: {}", trimmed_relay, e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("Failed to configure relay transport: {}", e))?;
    let writer = Arc::new(Mutex::new(
        stream
            .try_clone()
            .map_err(|e| format!("Failed to clone relay transport stream: {}", e))?,
    ));
    let shutdown = Arc::new(AtomicBool::new(false));
    let connected_peer_ids = Arc::new(Mutex::new(Vec::new()));
    let peer_id = next_transport_peer_id(&transport.runtime, "relay-host");

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::RelayHost(RelayTransportRuntime {
            shutdown: shutdown.clone(),
            writer: writer.clone(),
            relay_address: trimmed_relay.clone(),
            join_code: trimmed_join_code.clone(),
            peer_id: peer_id.clone(),
            connected_peer_ids: connected_peer_ids.clone(),
        });
    }

    send_relay_wire_message(
        &writer,
        &RelayClientWireMessage::RegisterHost {
            join_code: trimmed_join_code.clone(),
            peer_id: peer_id.clone(),
        },
    )?;

    spawn_relay_reader_thread(
        app.clone(),
        transport.runtime.clone(),
        stream,
        shutdown,
        connected_peer_ids,
    );

    emit_transport_event(
        &app,
        &transport.runtime,
        "host_started",
        None,
        None,
        None,
        Some(format!(
            "Relay host transport ready at {} // join code {}",
            trimmed_relay, trimmed_join_code
        )),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn start_squad_transport_relay_join(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    relay_address: String,
    join_code: String,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let trimmed_relay = relay_address.trim().to_string();
    if trimmed_relay.is_empty() {
        return Err("Enter a valid relay address before joining.".to_string());
    }
    let trimmed_join_code = join_code.trim().to_uppercase();
    if trimmed_join_code.is_empty() {
        return Err("Enter a valid join code before joining.".to_string());
    }

    let stream = TcpStream::connect(&trimmed_relay)
        .map_err(|e| format!("Failed to connect to relay {}: {}", trimmed_relay, e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("Failed to configure relay transport: {}", e))?;
    let writer = Arc::new(Mutex::new(
        stream
            .try_clone()
            .map_err(|e| format!("Failed to clone relay transport stream: {}", e))?,
    ));
    let shutdown = Arc::new(AtomicBool::new(false));
    let connected_peer_ids = Arc::new(Mutex::new(Vec::new()));
    let peer_id = next_transport_peer_id(&transport.runtime, "relay-client");

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::RelayClient(RelayTransportRuntime {
            shutdown: shutdown.clone(),
            writer: writer.clone(),
            relay_address: trimmed_relay.clone(),
            join_code: trimmed_join_code.clone(),
            peer_id: peer_id.clone(),
            connected_peer_ids: connected_peer_ids.clone(),
        });
    }

    send_relay_wire_message(
        &writer,
        &RelayClientWireMessage::JoinLobby {
            join_code: trimmed_join_code.clone(),
            peer_id: peer_id.clone(),
        },
    )?;

    spawn_relay_reader_thread(
        app.clone(),
        transport.runtime.clone(),
        stream,
        shutdown,
        connected_peer_ids,
    );

    emit_transport_event(
        &app,
        &transport.runtime,
        "client_connected",
        Some("relay".to_string()),
        None,
        None,
        Some(format!(
            "Linked to relay {} // join code {}",
            trimmed_relay, trimmed_join_code
        )),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn start_squad_transport_backend_host(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    backend_address: Option<String>,
    callsign: Option<String>,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let trimmed_backend = resolve_backend_address(backend_address)?;

    let stream = TcpStream::connect(&trimmed_backend)
        .map_err(|e| format!("Failed to reach the multiplayer service: {}", e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("Failed to configure backend transport: {}", e))?;
    let writer = Arc::new(Mutex::new(
        stream
            .try_clone()
            .map_err(|e| format!("Failed to clone backend transport stream: {}", e))?,
    ));
    let shutdown = Arc::new(AtomicBool::new(false));
    let connected_peer_ids = Arc::new(Mutex::new(Vec::new()));
    let peer_id = next_transport_peer_id(&transport.runtime, "backend-host");

    send_backend_wire_message(
        &writer,
        &BackendClientWireMessage::CreateLobby {
            peer_id: peer_id.clone(),
            callsign: callsign
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        },
    )?;

    let (stream, handshake_message) = await_backend_handshake(stream, "host lobby creation")?;
    let join_code = match handshake_message {
        BackendServerWireMessage::LobbyCreated { join_code, .. } => join_code,
        BackendServerWireMessage::Error { message } => return Err(message),
        _ => {
            return Err("Backend returned an unexpected host handshake.".to_string());
        }
    };

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::BackendHost(BackendTransportRuntime {
            shutdown: shutdown.clone(),
            writer: writer.clone(),
            backend_address: trimmed_backend.clone(),
            join_code: join_code.clone(),
            peer_id: peer_id.clone(),
            connected_peer_ids: connected_peer_ids.clone(),
        });
    }

    spawn_backend_reader_thread(
        app.clone(),
        transport.runtime.clone(),
        stream,
        shutdown,
        connected_peer_ids,
    );

    emit_transport_event(
        &app,
        &transport.runtime,
        "host_started",
        None,
        None,
        None,
        Some(format!("Lobby created. Share join code {}.", join_code)),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn start_squad_transport_backend_join(
    app: AppHandle,
    transport: State<SquadTransportManager>,
    backend_address: Option<String>,
    join_code: String,
    callsign: Option<String>,
) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    let trimmed_backend = resolve_backend_address(backend_address)?;
    let trimmed_join_code = join_code.trim().to_uppercase();
    if trimmed_join_code.is_empty() {
        return Err("Enter a valid join code before joining.".to_string());
    }

    let stream = TcpStream::connect(&trimmed_backend)
        .map_err(|e| format!("Failed to reach the multiplayer service: {}", e))?;
    stream
        .set_nodelay(true)
        .map_err(|e| format!("Failed to configure backend transport: {}", e))?;
    let writer = Arc::new(Mutex::new(
        stream
            .try_clone()
            .map_err(|e| format!("Failed to clone backend transport stream: {}", e))?,
    ));
    let shutdown = Arc::new(AtomicBool::new(false));
    let connected_peer_ids = Arc::new(Mutex::new(Vec::new()));
    let peer_id = next_transport_peer_id(&transport.runtime, "backend-client");

    send_backend_wire_message(
        &writer,
        &BackendClientWireMessage::JoinLobby {
            join_code: trimmed_join_code.clone(),
            peer_id: peer_id.clone(),
            callsign: callsign
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
        },
    )?;

    let (stream, handshake_message) = await_backend_handshake(stream, "join lobby")?;
    let confirmed_join_code = match handshake_message {
        BackendServerWireMessage::LobbyJoined { join_code, .. } => join_code,
        BackendServerWireMessage::Error { message } => return Err(message),
        _ => {
            return Err("Backend returned an unexpected join handshake.".to_string());
        }
    };

    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        runtime.role = SquadTransportRoleRuntime::BackendClient(BackendTransportRuntime {
            shutdown: shutdown.clone(),
            writer: writer.clone(),
            backend_address: trimmed_backend.clone(),
            join_code: confirmed_join_code.clone(),
            peer_id: peer_id.clone(),
            connected_peer_ids: connected_peer_ids.clone(),
        });
    }

    spawn_backend_reader_thread(
        app.clone(),
        transport.runtime.clone(),
        stream,
        shutdown,
        connected_peer_ids,
    );

    emit_transport_event(
        &app,
        &transport.runtime,
        "client_connected",
        Some("backend".to_string()),
        None,
        None,
        Some(format!("Joined lobby {}.", confirmed_join_code)),
    );

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn send_squad_transport_message(
    transport: State<SquadTransportManager>,
    message_kind: String,
    payload: String,
    target_peer_id: Option<String>,
) -> Result<SquadTransportStatus, String> {
    let writers: Vec<Arc<Mutex<TcpStream>>> = {
        let runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;

        match &runtime.role {
            SquadTransportRoleRuntime::Idle => {
                return Err("Squad transport is not active.".to_string());
            }
            SquadTransportRoleRuntime::Host(host) => {
                let connections = host
                    .connections
                    .lock()
                    .map_err(|_| "Failed to access host peer links.".to_string())?;
                if let Some(peer_id) = target_peer_id.as_ref() {
                    let target = connections
                        .get(peer_id)
                        .cloned()
                        .ok_or_else(|| format!("Peer {} is no longer connected.", peer_id))?;
                    vec![target]
                } else {
                    connections.values().cloned().collect()
                }
            }
            SquadTransportRoleRuntime::Client(client) => vec![client.writer.clone()],
            SquadTransportRoleRuntime::RelayHost(host) | SquadTransportRoleRuntime::RelayClient(host) => {
                send_relay_wire_message(
                    &host.writer,
                    &RelayClientWireMessage::Relay {
                        message_kind,
                        payload,
                        target_peer_id,
                    },
                )?;
                return Ok(current_transport_status(&transport.runtime));
            }
            SquadTransportRoleRuntime::BackendHost(host)
            | SquadTransportRoleRuntime::BackendClient(host) => {
                send_backend_wire_message(
                    &host.writer,
                    &BackendClientWireMessage::Relay {
                        message_kind,
                        payload,
                        target_peer_id,
                    },
                )?;
                return Ok(current_transport_status(&transport.runtime));
            }
        }
    };

    for writer in &writers {
        send_wire_message(writer, &message_kind, &payload)?;
    }

    Ok(current_transport_status(&transport.runtime))
}

#[command]
fn stop_squad_transport(app: AppHandle, transport: State<SquadTransportManager>) -> Result<SquadTransportStatus, String> {
    {
        let mut runtime = transport
            .runtime
            .lock()
            .map_err(|_| "Failed to access transport runtime.".to_string())?;
        shutdown_transport_runtime(&mut runtime);
    }

    emit_transport_event(
        &app,
        &transport.runtime,
        "stopped",
        None,
        None,
        None,
        Some("Squad transport shut down.".to_string()),
    );

    Ok(current_transport_status(&transport.runtime))
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .manage(SquadTransportManager::default())
        .invoke_handler(tauri::generate_handler![
            save_game,
            load_game,
            has_save,
            delete_save,
            list_saves,
            get_save_info,
            save_settings,
            load_settings,
            read_generated_technica_version,
            read_generated_technica_registry,
            read_generated_technica_entry,
            get_squad_transport_status,
            start_squad_transport_host,
            start_squad_transport_backend_host,
            start_squad_transport_relay_host,
            start_squad_transport_join,
            start_squad_transport_backend_join,
            start_squad_transport_relay_join,
            send_squad_transport_message,
            stop_squad_transport,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
