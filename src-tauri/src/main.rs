#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;
use tauri_plugin_dialog::DialogExt;

fn write_export(destination: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    let parent = destination.parent().ok_or_else(|| std::io::Error::other("Invalid destination"))?;
    let mut file = tempfile::NamedTempFile::new_in(parent)?;
    file.write_all(bytes)?;
    file.as_file().sync_all()?;
    file.persist(destination).map_err(|error| error.error)?;
    Ok(())
}

#[tauri::command]
async fn save_export(window: tauri::WebviewWindow, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let encoded = request.headers().get("x-pictora-filename")
        .and_then(|value| value.to_str().ok()).ok_or("Missing export name")?;
    let filename = percent_encoding::percent_decode_str(encoded).decode_utf8()
        .map_err(|_| "Invalid export name")?.into_owned();
    let extension = if filename.ends_with(".svg") { "svg" } else if filename.ends_with(".png") { "png" } else { return Err("Unsupported export format".into()); };
    // Only a suggested leaf name is accepted. The destination always comes from
    // a native, parented Save As dialog, never an IPC-supplied filesystem path.
    if filename.is_empty() || filename.chars().any(|c| c.is_control() || "\\/:*?\"<>|".contains(c)) {
        return Err("Invalid export name".into());
    }
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) if bytes.len() <= 128 * 1024 * 1024 => bytes.clone(),
        _ => return Err("Invalid or oversized export".into()),
    };
    tauri::async_runtime::spawn_blocking(move || {
        let selection = window.dialog().file().set_parent(&window)
            .set_title("Save Pictora template").set_file_name(&filename)
            .add_filter(if extension == "svg" { "SVG template" } else { "PNG image" }, &[extension])
            .blocking_save_file();
        let Some(selection) = selection else { return Ok(false); };
        let destination = selection.into_path().map_err(|_| "Invalid destination")?;
        // A same-directory temporary file prevents a failed write from truncating
        // an existing customer file. Persist replaces only the chosen destination.
        write_export(&destination, &bytes).map_err(|_| "The file could not be saved. Choose a writable folder and try again.".to_string())?;
        Ok(true)
    }).await.map_err(|_| "The save operation could not finish".to_string())?
}

#[cfg(test)]
mod tests {
    use super::write_export;
    #[test]
    fn unicode_spaces_and_atomic_overwrite() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("Pictora café ألوان template.svg");
        write_export(&destination, b"first").unwrap();
        write_export(&destination, b"replacement").unwrap();
        assert_eq!(std::fs::read(&destination).unwrap(), b"replacement");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }
    #[test]
    fn invalid_destination_cleans_temporary_file() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("existing-folder.svg");
        std::fs::create_dir(&destination).unwrap();
        assert!(write_export(&destination, b"export").is_err());
        assert!(destination.is_dir());
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }
    #[test]
    fn read_only_existing_file_survives_failed_save() {
        let directory = tempfile::tempdir().unwrap();
        let destination = directory.path().join("protected.png");
        std::fs::write(&destination, b"original").unwrap();
        let mut permissions = std::fs::metadata(&destination).unwrap().permissions();
        permissions.set_readonly(true);
        std::fs::set_permissions(&destination, permissions.clone()).unwrap();
        assert!(write_export(&destination, b"replacement").is_err());
        assert_eq!(std::fs::read(&destination).unwrap(), b"original");
        permissions.set_readonly(false);
        std::fs::set_permissions(&destination, permissions).unwrap();
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_export])
        .setup(|app| {
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_navigation(|url| {
                    url.scheme() == "tauri"
                        || url.host_str() == Some("tauri.localhost")
                        || (cfg!(debug_assertions)
                            && matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"))
                            && url.port() == Some(1420))
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Pictora could not start");
}
