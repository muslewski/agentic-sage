// Sage Island — Tauri commands: sage CLI invoke + soft actions + window fit.
//
// Transport (MacBook → manjaro desk):
//   SAGE_REMOTE=<ssh-host>  →  ssh -o BatchMode=yes host -- sage <args…>
//   (unset)                 →  local SAGE_BIN / PATH `sage`
// Optional:
//   SAGE_REMOTE_CWD=/path   →  remote: cd then run (board-scoped verbs)
//   SAGE_SSH=ssh            →  ssh binary override (default: ssh on PATH)
//   SAGE_BIN                →  local sage only (ignored for remote binary path;
//                              remote still invokes bare `sage` on the host PATH)
use std::path::PathBuf;
use std::process::Command;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewWindow};

#[derive(Clone, Debug)]
enum SageTransport {
    Local { bin: String },
    /// ssh Host alias (from ~/.ssh/config), e.g. `manjaro` / Tailscale MagicDNS.
    Remote { host: String, ssh_bin: String, remote_cwd: Option<String> },
}

fn resolve_ssh_bin() -> String {
    if let Ok(p) = std::env::var("SAGE_SSH") {
        if !p.is_empty() {
            return p;
        }
    }
    which_on_path("ssh").unwrap_or_else(|| "ssh".into())
}

fn resolve_transport() -> Result<SageTransport, String> {
    if let Ok(host) = std::env::var("SAGE_REMOTE") {
        let host = host.trim().to_string();
        if !host.is_empty() {
            let remote_cwd = std::env::var("SAGE_REMOTE_CWD")
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty());
            return Ok(SageTransport::Remote {
                host,
                ssh_bin: resolve_ssh_bin(),
                remote_cwd,
            });
        }
    }
    Ok(SageTransport::Local {
        bin: resolve_sage_bin()?,
    })
}

/// Resolve the local `sage` binary: `SAGE_BIN` env → first executable named `sage` on PATH.
fn resolve_sage_bin() -> Result<String, String> {
    if let Ok(p) = std::env::var("SAGE_BIN") {
        if !p.is_empty() {
            return Ok(p);
        }
    }
    which_on_path("sage")
        .ok_or_else(|| "sage binary not found on PATH (set SAGE_BIN or SAGE_REMOTE)".into())
}

/// Shell-escape a single arg for a remote `sh -c` command string.
fn sh_single_quote(s: &str) -> String {
    // 'foo'\''bar' pattern
    format!("'{}'", s.replace('\'', "'\\''"))
}

/// Build remote command: optional `cd` + `sage` + args (all shell-quoted).
fn remote_shell_command(remote_cwd: Option<&str>, args: &[String]) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(cwd) = remote_cwd {
        parts.push(format!("cd {} &&", sh_single_quote(cwd)));
    }
    parts.push(sh_single_quote("sage"));
    for a in args {
        parts.push(sh_single_quote(a));
    }
    parts.join(" ")
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

/// Spawn local or remote `sage` with the given args; return stdout.
/// Fail-open: prefer stdout even if exit ≠ 0 when stdout is non-empty.
#[tauri::command]
fn run_sage(args: Vec<String>) -> Result<String, String> {
    let transport = resolve_transport()?;
    let out = match &transport {
        SageTransport::Local { bin } => Command::new(bin)
            .args(&args)
            .output()
            .map_err(|e| format!("spawn {bin}: {e}"))?,
        SageTransport::Remote {
            host,
            ssh_bin,
            remote_cwd,
        } => {
            let remote_cmd = remote_shell_command(remote_cwd.as_deref(), &args);
            // BatchMode: no password prompts (use ssh keys / config). ConnectTimeout keeps island snappy.
            Command::new(ssh_bin)
                .args([
                    "-o",
                    "BatchMode=yes",
                    "-o",
                    "ConnectTimeout=5",
                    "-o",
                    "StrictHostKeyChecking=accept-new",
                    host.as_str(),
                    "--",
                    "sh",
                    "-c",
                    &remote_cmd,
                ])
                .output()
                .map_err(|e| format!("ssh {host}: {e}"))?
        }
    };
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if stdout.trim().is_empty() && !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).to_string();
        let where_ = match &transport {
            SageTransport::Local { bin } => bin.clone(),
            SageTransport::Remote { host, .. } => format!("ssh:{host}"),
        };
        return Err(format!("sage ({where_}) exited {}: {stderr}", out.status));
    }
    Ok(stdout)
}

/// Connection mode for UI badge / soft-action branching.
/// Returns JSON: `{"mode":"local"|"remote","host":null|"…","remote_cwd":null|"…"}`
#[tauri::command]
fn get_sage_transport() -> Result<String, String> {
    let t = resolve_transport()?;
    let json = match t {
        SageTransport::Local { .. } => {
            r#"{"mode":"local","host":null,"remote_cwd":null}"#.to_string()
        }
        SageTransport::Remote {
            host,
            remote_cwd,
            ..
        } => {
            let cwd = remote_cwd
                .as_ref()
                .map(|c| format!("\"{}\"", c.replace('\\', "\\\\").replace('"', "\\\"")))
                .unwrap_or_else(|| "null".into());
            let host_esc = host.replace('\\', "\\\\").replace('"', "\\\"");
            format!(r#"{{"mode":"remote","host":"{host_esc}","remote_cwd":{cwd}}}"#)
        }
    };
    Ok(json)
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

/// Resize the main island window (logical px) and re-center at top edge.
#[tauri::command]
fn fit_island(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let w = width.clamp(120.0, 1200.0);
    let h = height.clamp(40.0, 900.0);
    window
        .set_size(LogicalSize::new(w, h))
        .map_err(|e| format!("set_size: {e}"))?;
    position_top_center(&window);
    Ok(())
}

/// Toggle main window visibility. Returns whether the window is visible after the call.
#[tauri::command]
fn toggle_island_visible(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let visible = window.is_visible().unwrap_or(true);
    if visible {
        window.hide().map_err(|e| format!("hide: {e}"))?;
        Ok(false)
    } else {
        window.show().map_err(|e| format!("show: {e}"))?;
        let _ = window.set_focus();
        Ok(true)
    }
}

/// Place the island near the top-center of the current monitor (y ≈ 10 px).
fn position_top_center(window: &WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let screen = monitor.size();
    let scale = monitor.scale_factor();
    let Ok(outer) = window.outer_size() else {
        return;
    };
    // Convert physical → logical so LogicalPosition matches monitor metrics.
    let screen_w = screen.width as f64 / scale;
    let win_w = outer.width as f64 / scale;
    let x = ((screen_w - win_w) / 2.0).max(0.0);
    let y = 10.0_f64;
    let _ = window.set_position(LogicalPosition::new(x, y));
}

fn toggle_main_visibility(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(true);
        if visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sh_single_quote_plain() {
        assert_eq!(sh_single_quote("sage"), "'sage'");
    }

    #[test]
    fn sh_single_quote_with_apostrophe() {
        assert_eq!(sh_single_quote("it's"), "'it'\\''s'");
    }

    #[test]
    fn remote_cmd_with_cwd() {
        let args = vec!["fleet".into(), "--json".into()];
        let cmd = remote_shell_command(Some("/home/kento/Repositories"), &args);
        assert!(cmd.contains("cd '/home/kento/Repositories' &&"));
        assert!(cmd.contains("'sage'"));
        assert!(cmd.contains("'fleet'"));
        assert!(cmd.contains("'--json'"));
    }

    #[test]
    fn remote_cmd_no_cwd() {
        let args = vec!["board".into(), "--json".into()];
        let cmd = remote_shell_command(None, &args);
        assert!(!cmd.contains("cd "));
        assert_eq!(cmd, "'sage' 'board' '--json'");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            run_sage,
            get_sage_transport,
            copy_text,
            open_path,
            fit_island,
            toggle_island_visible
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                position_top_center(&window);
            }

            // Global hide/show: Super/Cmd+Shift+\ (desktop only; fail-open if grab fails).
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{
                    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
                };

                let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Backslash);
                let handle = app.handle().clone();
                if let Err(e) = app.global_shortcut().on_shortcut(shortcut, move |_app, _s, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_main_visibility(&handle);
                    }
                }) {
                    eprintln!("sage-island: global shortcut register failed: {e}");
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
