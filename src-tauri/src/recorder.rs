use crate::encoder::Mp4Encoder;
use crate::RecordingEvent;
use image::RgbaImage;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::ipc::Channel;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use xcap::Monitor;

/// Global flag: is a recording currently in progress?
static RECORDING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Channel to send the stop signal to the capture loop.
static STOP_SENDER: Mutex<Option<tokio::sync::oneshot::Sender<()>>> = Mutex::new(None);

/// Channel to receive the result (file path) after recording finishes.
static RESULT_RECEIVER: Mutex<Option<tokio::sync::oneshot::Receiver<String>>> = Mutex::new(None);

/// Start recording the Tauri application window.
///
/// Captures the app window by taking a full monitor screenshot and cropping to
/// the window's inner (client/WebView2) area.
///
/// On Windows, xcap's Window::all() excludes the current process's own windows,
/// so window.capture_image() cannot be used to capture a Tauri app window.
/// Using monitor capture + crop avoids this limitation entirely.
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

    // Open save dialog
    let save_path = get_save_path(&app)?;

    // Take an initial capture to determine dimensions
    let first_frame = capture_app_window(&app)
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

    // Clone AppHandle for the background thread (AppHandle is Clone + Send + Sync)
    let app_clone = app.clone();

    // Spawn the capture loop on a blocking thread (does CPU-intensive work)
    let recording_start = Instant::now();
    tokio::task::spawn_blocking(move || {
        let result = capture_loop(&app_clone, &mut encoder, fps, stop_rx, &on_progress);
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
    app: &tauri::AppHandle,
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
        match capture_app_window(app) {
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

/// Capture the app's inner (client/WebView2) area via monitor screenshot + crop.
///
/// # Why monitor capture instead of window capture?
///
/// xcap's `Window::all()` on Windows explicitly excludes windows that belong to
/// the current process (`GetCurrentProcessId()` check in `is_valid_window`).
/// This means `Window::capture_image()` is unavailable for a Tauri app capturing
/// itself.
///
/// Instead, we:
/// 1. Get the window's inner (WebView2 content) position and size from Tauri.
///    `inner_position()` / `inner_size()` return physical-pixel coordinates,
///    excluding the native title bar and window borders.
/// 2. Find the monitor that contains the window center.
/// 3. Capture the full monitor (uses GDI BitBlt on the DWM-composited desktop,
///    which correctly includes hardware-accelerated WebView2 content).
/// 4. Crop to the window's inner bounds.
fn capture_app_window(
    app: &tauri::AppHandle,
) -> Result<RgbaImage, Box<dyn std::error::Error + Send + Sync>> {
    let tauri_win = app
        .get_webview_window("main")
        .ok_or("Tauri main window not found")?;

    // Use inner position/size (client area = WebView2 content, no title bar/borders)
    let pos = tauri_win
        .inner_position()
        .map_err(|e| format!("Failed to get window inner position: {}", e))?;
    let size = tauri_win
        .inner_size()
        .map_err(|e| format!("Failed to get window inner size: {}", e))?;

    let win_x = pos.x;
    let win_y = pos.y;
    let win_w = size.width;
    let win_h = size.height;

    if win_w == 0 || win_h == 0 {
        return Err("Window has zero size".into());
    }

    // Find the monitor that contains the window center.
    // Fallback to primary monitor, then to the first available monitor.
    let center_x = win_x.saturating_add((win_w / 2) as i32);
    let center_y = win_y.saturating_add((win_h / 2) as i32);

    let monitors = Monitor::all()
        .map_err(|e| format!("Failed to enumerate monitors: {}", e))?;

    let monitor_idx = monitors
        .iter()
        .position(|m| {
            let mx = m.x().unwrap_or(0);
            let my = m.y().unwrap_or(0);
            let mw = m.width().unwrap_or(0) as i32;
            let mh = m.height().unwrap_or(0) as i32;
            center_x >= mx && center_x < mx + mw && center_y >= my && center_y < my + mh
        })
        // Fallback: primary monitor
        .or_else(|| monitors.iter().position(|m| m.is_primary().unwrap_or(false)))
        // Fallback: first monitor
        .unwrap_or(0);

    let monitor = monitors.get(monitor_idx).ok_or("No monitors available")?;

    // Capture the full monitor screenshot.
    // xcap uses GDI BitBlt on the DWM desktop window DC, which reads the
    // composited framebuffer and correctly captures WebView2 content.
    let screen = monitor
        .capture_image()
        .map_err(|e| format!("Monitor capture failed: {}", e))?;

    // Compute the window's position relative to the monitor's captured image.
    // Both Tauri's inner_position() and xcap's Monitor::x()/y() use physical
    // pixel screen coordinates on DPI-aware processes (which Tauri 2 is).
    let mon_x = monitor.x().unwrap_or(0);
    let mon_y = monitor.y().unwrap_or(0);

    let rel_x = (win_x - mon_x).max(0) as u32;
    let rel_y = (win_y - mon_y).max(0) as u32;

    // Clamp crop dimensions to stay within the captured image bounds
    let avail_w = screen.width().saturating_sub(rel_x);
    let avail_h = screen.height().saturating_sub(rel_y);
    let crop_w = win_w.min(avail_w);
    let crop_h = win_h.min(avail_h);

    if crop_w == 0 || crop_h == 0 {
        return Err("Window bounds are outside monitor area".into());
    }

    Ok(image::DynamicImage::ImageRgba8(screen)
        .crop_imm(rel_x, rel_y, crop_w, crop_h)
        .to_rgba8())
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
