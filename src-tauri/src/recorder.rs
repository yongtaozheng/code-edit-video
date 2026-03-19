use crate::encoder::Mp4Encoder;
use crate::RecordingEvent;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use xcap::Window;

/// Wrapper to make `xcap::Window` Send-safe.
///
/// On Windows, `xcap::Window` contains an `HWND` (`*mut c_void`) which is
/// not `Send`. However, we only ever use the window from a single blocking
/// thread after moving it there, so this is safe.
struct SendableWindow(Window);
unsafe impl Send for SendableWindow {}

impl std::ops::Deref for SendableWindow {
    type Target = Window;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// Global flag: is a recording currently in progress?
static RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Channel to send the stop signal to the capture loop.
static STOP_SENDER: Mutex<Option<tokio::sync::oneshot::Sender<()>>> = Mutex::new(None);

/// Channel to receive the result (file path) after recording finishes.
static RESULT_RECEIVER: Mutex<Option<tokio::sync::oneshot::Receiver<String>>> = Mutex::new(None);

/// Start recording the Tauri application window.
///
/// 1. Finds the Tauri window via xcap (matches by window title)
/// 2. Opens a save dialog for the output MP4 path
/// 3. Spawns a background thread running the capture loop
/// 4. Sends progress events to the frontend via Tauri Channel
pub async fn start_recording(
    app: tauri::AppHandle,
    fps: u32,
    on_progress: Channel<RecordingEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Prevent concurrent recordings
    if RECORDING_ACTIVE.swap(true, Ordering::SeqCst) {
        return Err("Recording already in progress".into());
    }

    let fps = fps.clamp(1, 60);

    // Find the Tauri window using xcap
    let xcap_window = find_app_window(&app)?;

    // Open save dialog
    let save_path = get_save_path(&app)?;

    // Take an initial capture to determine dimensions
    let first_frame = xcap_window
        .capture_image()
        .map_err(|e| format!("Initial capture failed: {}", e))?;
    let width = first_frame.width();
    let height = first_frame.height();

    // Create the encoder
    let mut encoder = Mp4Encoder::new(&save_path, width, height, fps)?;

    // Encode the first frame
    encoder.encode_frame(&first_frame)?;

    // Set up stop signal
    let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
    {
        let mut sender = STOP_SENDER.lock().unwrap();
        *sender = Some(stop_tx);
    }

    // Set up result channel
    let (result_tx, result_rx) = tokio::sync::oneshot::channel::<String>();
    {
        let mut receiver = RESULT_RECEIVER.lock().unwrap();
        *receiver = Some(result_rx);
    }

    // Notify frontend that recording has started
    let _ = on_progress.send(RecordingEvent::Started);

    // Wrap xcap::Window in a Send-safe wrapper for the blocking thread
    let sendable_window = SendableWindow(xcap_window);

    // Spawn the capture loop on a blocking thread (does CPU-intensive work)
    let recording_start = Instant::now();
    tokio::task::spawn_blocking(move || {
        let result = capture_loop(&sendable_window, &mut encoder, fps, stop_rx, &on_progress);
        let actual_duration = recording_start.elapsed().as_secs_f64();

        match result {
            Ok(()) => {
                // Finalize the MP4 — pass actual wall-clock duration
                // so minimp4 writes the correct playback length
                match encoder.finish(actual_duration) {
                    Ok(stats) => {
                        let _ = on_progress.send(RecordingEvent::Finished {
                            file_path: save_path.clone(),
                            total_frames: stats.total_frames,
                            total_duration_secs: stats.total_duration_secs,
                            file_size_bytes: stats.file_size_bytes,
                        });
                        let _ = result_tx.send(save_path);
                    }
                    Err(e) => {
                        let _ = on_progress.send(RecordingEvent::Error {
                            message: format!("Encoding finalization failed: {}", e),
                        });
                        let _ = result_tx.send(String::new());
                    }
                }
            }
            Err(e) => {
                let _ = on_progress.send(RecordingEvent::Error {
                    message: format!("Recording failed: {}", e),
                });
                let _ = result_tx.send(String::new());
            }
        }

        RECORDING_ACTIVE.store(false, Ordering::SeqCst);
    });

    Ok(())
}

/// Stop the current recording and wait for the result.
pub async fn stop_recording() -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // Send the stop signal
    let sender = {
        let mut guard = STOP_SENDER.lock().unwrap();
        guard.take()
    };

    match sender {
        Some(tx) => {
            let _ = tx.send(());
        }
        None => {
            return Err("No active recording to stop".into());
        }
    }

    // Wait for the result
    let receiver = {
        let mut guard = RESULT_RECEIVER.lock().unwrap();
        guard.take()
    };

    match receiver {
        Some(rx) => {
            let path = rx.await.unwrap_or_default();
            if path.is_empty() {
                Err("Recording failed".into())
            } else {
                Ok(path)
            }
        }
        None => Err("No result receiver available".into()),
    }
}

/// The main capture loop that runs on a blocking thread.
///
/// Captures every frame at the target FPS (constant frame rate).
/// H.264 natively handles unchanged frames efficiently via P-frames,
/// so we always encode — this ensures frame_count == elapsed_time × fps,
/// which is required for minimp4's fixed-fps muxing.
fn capture_loop(
    window: &SendableWindow,
    encoder: &mut Mp4Encoder,
    fps: u32,
    mut stop_rx: tokio::sync::oneshot::Receiver<()>,
    on_progress: &Channel<RecordingEvent>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let frame_duration = Duration::from_secs_f64(1.0 / fps as f64);
    let start_time = Instant::now();
    let mut frame_count: u64 = 1; // first frame already encoded
    let mut progress_tick = Instant::now();

    loop {
        let frame_start = Instant::now();

        // Check for stop signal (non-blocking)
        match stop_rx.try_recv() {
            Ok(()) | Err(tokio::sync::oneshot::error::TryRecvError::Closed) => {
                break;
            }
            Err(tokio::sync::oneshot::error::TryRecvError::Empty) => {
                // Continue recording
            }
        }

        // Capture and encode every frame (CFR — constant frame rate)
        match window.capture_image() {
            Ok(frame) => {
                if let Err(e) = encoder.encode_frame(&frame) {
                    log::warn!("Frame encode error: {}", e);
                }
                frame_count += 1;

                // Send progress update every ~500ms
                if progress_tick.elapsed() >= Duration::from_millis(500) {
                    let _ = on_progress.send(RecordingEvent::Progress {
                        duration_secs: start_time.elapsed().as_secs_f64(),
                        frame_count,
                        file_size_bytes: encoder.estimated_size(),
                    });
                    progress_tick = Instant::now();
                }
            }
            Err(e) => {
                log::warn!("Frame capture failed: {}", e);
            }
        }

        // Sleep to maintain target frame rate
        let elapsed = frame_start.elapsed();
        if elapsed < frame_duration {
            std::thread::sleep(frame_duration - elapsed);
        }
    }

    Ok(())
}

/// Find the application's own window via xcap by matching the window title.
fn find_app_window(
    app: &tauri::AppHandle,
) -> Result<Window, Box<dyn std::error::Error + Send + Sync>> {
    let tauri_win = app
        .get_webview_window("main")
        .ok_or("Tauri main window not found")?;
    let tauri_title = tauri_win.title().unwrap_or_default();
    let expected = normalize_window_text(&tauri_title);

    let windows = Window::all().map_err(|e| format!("Failed to enumerate windows: {}", e))?;

    // 1) Strict title match first.
    if let Some(win) = windows
        .iter()
        .find(|w| normalize_window_text(&w.title().unwrap_or_default()) == expected)
        .cloned()
    {
        return Ok(win);
    }

    // 2) Best-effort scored match for Windows title/app-name variations.
    let mut best: Option<(i32, Window)> = None;
    for win in windows.iter().cloned() {
        let win_title_raw = win.title().unwrap_or_default();
        let win_app_raw = win.app_name().unwrap_or_default();
        let win_title = normalize_window_text(&win_title_raw);
        let win_app = normalize_window_text(&win_app_raw);

        let mut score = 0;
        if !expected.is_empty() {
            if win_title.contains(&expected) || expected.contains(&win_title) {
                score += 80;
            }
            if win_app.contains(&expected) {
                score += 70;
            }
            for token in expected.split_whitespace() {
                if token.len() >= 2 && (win_title.contains(token) || win_app.contains(token)) {
                    score += 15;
                }
            }
        }
        if win_title.contains("code edit video") || win_app.contains("code edit video") {
            score += 60;
        }
        if win_app.contains("code-edit-video") || win_app.contains("code_edit_video") {
            score += 60;
        }
        if win.is_focused().unwrap_or(false) {
            score += 10;
        }
        if !win.is_minimized().unwrap_or(false) {
            score += 5;
        }

        if score > 0 && best.as_ref().map(|(s, _)| score > *s).unwrap_or(true) {
            best = Some((score, win));
        }
    }
    if let Some((_, win)) = best {
        return Ok(win);
    }

    let details = windows
        .iter()
        .take(8)
        .map(|w| {
            let title = w.title().unwrap_or_else(|_| "<title-error>".to_string());
            let app = w.app_name().unwrap_or_else(|_| "<app-error>".to_string());
            format!("\"{}\" (app: \"{}\")", title, app)
        })
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "Could not find app window. Tauri title='{}'. Found {} windows. Top candidates: [{}]",
        tauri_title,
        windows.len(),
        details
    )
    .into())
}

fn normalize_window_text(input: &str) -> String {
    input
        .trim()
        .to_ascii_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Show a save-file dialog and return the chosen path.
fn get_save_path(
    app: &tauri::AppHandle,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let now = chrono::Local::now();
    let timestamp = now.format("%Y%m%d_%H%M%S");
    let default_name = format!("code-typing-{}.mp4", timestamp);

    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("MP4 Video", &["mp4"])
        .blocking_save_file()
        .ok_or("Save dialog was cancelled")?;

    Ok(file_path.to_string())
}
