mod encoder;
mod recorder;

use serde::Serialize;
use tauri::ipc::Channel;

/// Recording progress events sent to the frontend via Tauri Channel.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum RecordingEvent {
    /// Recording has started
    #[serde(rename_all = "camelCase")]
    Started,

    /// Periodic progress update
    #[serde(rename_all = "camelCase")]
    Progress {
        duration_secs: f64,
        frame_count: u64,
        file_size_bytes: u64,
    },

    /// Recording finished successfully
    #[serde(rename_all = "camelCase")]
    Finished {
        file_path: String,
        total_frames: u64,
        total_duration_secs: f64,
        file_size_bytes: u64,
    },

    /// An error occurred
    #[serde(rename_all = "camelCase")]
    Error { message: String },
}

/// Start recording the Tauri window.
///
/// Captures frames from the window at the specified FPS, encodes them as H.264,
/// and writes the result to an MP4 file chosen by the user via a save dialog.
#[tauri::command]
async fn start_recording(
    app: tauri::AppHandle,
    fps: u32,
    on_progress: Channel<RecordingEvent>,
) -> Result<(), String> {
    recorder::start_recording(app, fps, on_progress)
        .await
        .map_err(|e| e.to_string())
}

/// Stop the current recording.
///
/// Returns the path to the saved MP4 file.
#[tauri::command]
async fn stop_recording() -> Result<String, String> {
    recorder::stop_recording()
        .await
        .map_err(|e| e.to_string())
}

/// Returns true when running inside Tauri (used for environment detection).
#[tauri::command]
fn is_desktop() -> bool {
    true
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            is_desktop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
