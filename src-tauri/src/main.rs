// ============================================================================
// CHAOS CORE - TAURI MAIN.RS
// Complete drop-in replacement with save/load/settings commands
// ============================================================================

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::fs;
use std::path::PathBuf;
use directories::ProjectDirs;
use tauri::command;
use serde::{Deserialize, Serialize};

// ----------------------------------------------------------------------------
// SAVE DIRECTORY MANAGEMENT
// ----------------------------------------------------------------------------

/// Get the save directory path, creating it if it doesn't exist
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

/// Get path to a specific save file
fn get_save_path(slot: &str) -> Result<PathBuf, String> {
    let save_dir = get_save_dir()?;
    Ok(save_dir.join(format!("{}.json", slot)))
}

/// Get settings file path
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

// ----------------------------------------------------------------------------
// SAVE/LOAD COMMANDS
// ----------------------------------------------------------------------------

/// Save game state to a specific slot
#[command]
fn save_game(slot: String, json: String) -> Result<(), String> {
    let save_path = get_save_path(&slot)?;
    
    fs::write(&save_path, &json)
        .map_err(|e| format!("Failed to write save file: {}", e))?;
    
    println!("[SAVE] Game saved to slot: {}", slot);
    Ok(())
}

/// Load game state from a specific slot
#[command]
fn load_game(slot: String) -> Result<String, String> {
    let save_path = get_save_path(&slot)?;
    
    if !save_path.exists() {
        return Err(format!("No save file found for slot: {}", slot));
    }
    
    let json = fs::read_to_string(&save_path)
        .map_err(|e| format!("Failed to read save file: {}", e))?;
    
    println!("[LOAD] Game loaded from slot: {}", slot);
    Ok(json)
}

/// Check if a save exists for a given slot
#[command]
fn has_save(slot: String) -> Result<bool, String> {
    let save_path = get_save_path(&slot)?;
    Ok(save_path.exists())
}

/// Delete a save file
#[command]
fn delete_save(slot: String) -> Result<(), String> {
    let save_path = get_save_path(&slot)?;
    
    if save_path.exists() {
        fs::remove_file(&save_path)
            .map_err(|e| format!("Failed to delete save file: {}", e))?;
        println!("[DELETE] Save deleted: {}", slot);
    }
    
    Ok(())
}

/// List all available save slots
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
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
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
    
    // Sort by timestamp descending (newest first)
    saves.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    
    Ok(saves)
}

/// Get save file metadata
#[command]
fn get_save_info(slot: String) -> Result<SaveInfo, String> {
    let save_path = get_save_path(&slot)?;
    
    if !save_path.exists() {
        return Err(format!("No save file found for slot: {}", slot));
    }
    
    let metadata = fs::metadata(&save_path)
        .map_err(|e| format!("Failed to read save metadata: {}", e))?;
    
    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    
    Ok(SaveInfo {
        slot,
        timestamp: modified,
    })
}

// ----------------------------------------------------------------------------
// SETTINGS COMMANDS
// ----------------------------------------------------------------------------

/// Save settings to disk
#[command]
fn save_settings(json: String) -> Result<(), String> {
    let settings_path = get_settings_path()?;
    
    fs::write(&settings_path, &json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;
    
    println!("[SETTINGS] Settings saved");
    Ok(())
}

/// Load settings from disk
#[command]
fn load_settings() -> Result<String, String> {
    let settings_path = get_settings_path()?;
    
    if !settings_path.exists() {
        return Err("No settings file found".to_string());
    }
    
    let json = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;
    
    println!("[SETTINGS] Settings loaded");
    Ok(json)
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_game,
            load_game,
            has_save,
            delete_save,
            list_saves,
            get_save_info,
            save_settings,
            load_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}