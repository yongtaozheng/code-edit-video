use image::RgbaImage;
use openh264::encoder::Encoder;
use openh264::formats::{RgbSliceU8, YUVBuffer};
use std::fs::File;
use std::io::{Cursor, Write};

/// Statistics returned after encoding completes.
pub struct EncoderStats {
    pub total_frames: u64,
    pub total_duration_secs: f64,
    pub file_size_bytes: u64,
}

/// A single encoded H.264 frame.
struct H264Frame {
    data: Vec<u8>,
}

/// H.264 encoder that accumulates frames and writes an MP4 on finish.
///
/// Pipeline: RGBA image → RGB → YUV420 → OpenH264 encode → accumulate NAL units
/// On finish: concatenate all NAL units → minimp4 mux → MP4 file
pub struct Mp4Encoder {
    encoder: Encoder,
    frames: Vec<H264Frame>,
    width: u32,
    height: u32,
    fps: u32,
    frame_count: u64,
    file_path: String,
    /// Pre-allocated RGB buffer to avoid repeated allocation
    rgb_buffer: Vec<u8>,
}

impl Mp4Encoder {
    /// Create a new encoder for the given output path and video dimensions.
    ///
    /// Width and height are automatically rounded down to even numbers (H.264 requirement).
    pub fn new(
        file_path: &str,
        width: u32,
        height: u32,
        fps: u32,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        // H.264 requires even dimensions
        let width = width & !1;
        let height = height & !1;

        // Create encoder with default settings (requires "source" feature)
        let encoder = Encoder::new()?;

        let pixel_count = (width * height) as usize;

        Ok(Self {
            encoder,
            frames: Vec::new(),
            width,
            height,
            fps,
            frame_count: 0,
            file_path: file_path.to_string(),
            rgb_buffer: vec![0u8; pixel_count * 3],
        })
    }

    /// Encode a single RGBA frame.
    ///
    /// If the frame dimensions don't match the encoder, the frame is resized.
    pub fn encode_frame(
        &mut self,
        frame: &RgbaImage,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (fw, fh) = frame.dimensions();

        // Resize if needed (e.g. window was resized during recording)
        let frame = if fw != self.width || fh != self.height {
            image::imageops::resize(
                frame,
                self.width,
                self.height,
                image::imageops::FilterType::Nearest,
            )
        } else {
            frame.clone()
        };

        // RGBA → RGB: strip alpha channel into pre-allocated buffer
        let rgba_pixels = frame.as_raw();
        let pixel_count = (self.width * self.height) as usize;
        for i in 0..pixel_count {
            self.rgb_buffer[i * 3] = rgba_pixels[i * 4];
            self.rgb_buffer[i * 3 + 1] = rgba_pixels[i * 4 + 1];
            self.rgb_buffer[i * 3 + 2] = rgba_pixels[i * 4 + 2];
        }

        // RGB → YUV420 conversion
        let rgb_source = RgbSliceU8::new(
            &self.rgb_buffer,
            (self.width as usize, self.height as usize),
        );
        let yuv = YUVBuffer::from_rgb_source(rgb_source);

        // H.264 encode
        let bitstream = self.encoder.encode(&yuv)?;
        let h264_bytes = bitstream.to_vec();

        if !h264_bytes.is_empty() {
            self.frames.push(H264Frame { data: h264_bytes });
        }

        self.frame_count += 1;
        Ok(())
    }

    /// Estimated current output size (sum of all encoded frame data).
    pub fn estimated_size(&self) -> u64 {
        self.frames.iter().map(|f| f.data.len() as u64).sum()
    }

    /// Finalize encoding and write the MP4 file.
    ///
    /// `actual_duration_secs` is the real wall-clock recording time.
    /// We compute the true fps from `frame_count / actual_duration` so that
    /// the MP4 duration matches the real recording length, regardless of
    /// how fast or slow the capture loop actually ran.
    pub fn finish(self, actual_duration_secs: f64) -> Result<EncoderStats, Box<dyn std::error::Error + Send + Sync>> {
        // Concatenate all H.264 frame data
        let total_h264_size: usize = self.frames.iter().map(|f| f.data.len()).sum();
        let mut h264_stream = Vec::with_capacity(total_h264_size);
        for frame in &self.frames {
            h264_stream.extend_from_slice(&frame.data);
        }

        // Calculate the ACTUAL fps from real elapsed time so minimp4 produces
        // the correct duration: frames / actual_fps == actual_duration
        let actual_fps = if actual_duration_secs > 0.0 {
            (self.frame_count as f64 / actual_duration_secs).round().max(1.0) as u32
        } else {
            self.fps
        };

        // Try MP4 muxing, fall back to raw H.264 on failure
        let mp4_result = write_mp4(
            &self.file_path,
            &h264_stream,
            self.width,
            self.height,
            actual_fps,
        );

        let file_path = match mp4_result {
            Ok(()) => self.file_path.clone(),
            Err(e) => {
                log::warn!("MP4 muxing failed ({}), writing raw H.264 as fallback", e);
                let h264_path = self.file_path.replace(".mp4", ".h264");
                let mut file = File::create(&h264_path)?;
                file.write_all(&h264_stream)?;
                h264_path
            }
        };

        let file_size = std::fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(EncoderStats {
            total_frames: self.frame_count,
            total_duration_secs: actual_duration_secs,
            file_size_bytes: file_size,
        })
    }
}

/// Write concatenated H.264 bitstream to MP4 container using minimp4.
///
/// minimp4 requires a writer that implements both Write + Seek,
/// so we use a Cursor<Vec<u8>> in memory, then flush to disk.
fn write_mp4(
    file_path: &str,
    h264_stream: &[u8],
    width: u32,
    height: u32,
    fps: u32,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let buf = Vec::new();
    let mut cursor = Cursor::new(buf);

    {
        let mut muxer = minimp4::Mp4Muxer::new(&mut cursor);
        muxer.init_video(width as i32, height as i32, false, "Code Edit Video");
        muxer.write_video_with_fps(h264_stream, fps);
        muxer.close();
    }

    // Write the MP4 data to disk
    let mut file = File::create(file_path)?;
    file.write_all(cursor.get_ref())?;

    Ok(())
}
