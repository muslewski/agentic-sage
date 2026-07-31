// Sage Island — Tauri commands: sage CLI invoke + soft actions.
use std::path::PathBuf;
use std::process::Command;

/// Resolve the `sage` binary: `SAGE_BIN` env → first executable named `sage` on PATH.
fn resolve_sage_bin() -> Result<String, String> {
    if let Ok(p) = std::env::var("SAGE_BIN") {
        if !p.is_empty() {
            return Ok(p);
        }
    }
    which_on_path("sage")
        .ok_or_else(|| "sage binary not found on PATH (set SAGE_BIN)".into())
}

/// Minimal PATH scan (no `which` crate).
fn which_on_path(name: &str) -> Option<String> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if is_executable(&candidate) {
            return Some(candidate.to_string_lossy().into_owned());
        }
        #[cfg(windows)]
        {
            let exe = dir.join(format!("{name}.exe"));
            if is_executable(&exe) {
                return Some(exe.to_string_lossy().into_owned());
            }
        }
    }
    None
}

fn is_executable(path: &PathBuf) -> bool {
    if !path.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        path.metadata()
            .map(|m| m.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }
    #[cfg(not(unix))]
    {
        true
    }
}

/// Spawn `sage` with the given args; return stdout (fail-open: prefer stdout even if exit ≠ 0).
#[tauri::command]
fn run_sage(args: Vec<String>) -> Result<String, String> {
    let bin = resolve_sage_bin()?;
    let out = Command::new(&bin)
        .args(&args)
        .output()
        .map_err(|e| format!("spawn {bin}: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if stdout.trim().is_empty() && !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        return Err(format!("sage exited {}: {stderr}", out.status));
    }
    Ok(stdout)
}

/// Copy text to the system clipboard via `arboard`.
#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("clipboard open: {e}"))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("clipboard set: {e}"))
}

/// Open a filesystem path with the OS default handler (`open` / `xdg-open`).
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("open {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("xdg-open {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("start {path}: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = path;
        Err("open_path unsupported on this OS".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_sage, copy_text, open_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
