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
            get_squad_transport_status,
            start_squad_transport_host,
            start_squad_transport_join,
            send_squad_transport_message,
            stop_squad_transport,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
