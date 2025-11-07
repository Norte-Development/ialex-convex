import { logger } from '../middleware/logging.js';

// Supported audio/video formats that Deepgram can handle
export const SUPPORTED_AUDIO_FORMATS = new Set([
  'audio/mpeg',      // .mp3
  'audio/wav',       // .wav
  'audio/mp4',       // .m4a
  'audio/aac',       // .aac
  'audio/flac',      // .flac
  'audio/ogg',       // .ogg
  'audio/webm',      // .webm
]);

export const SUPPORTED_VIDEO_FORMATS = new Set([
  'video/mp4',       // .mp4
  'video/webm',      // .webm
  'video/avi',       // .avi
  'video/mov',       // .mov, .qt
  'video/quicktime', // .mov
  'video/mpeg',      // .mpg, .mpeg
  'video/x-msvideo', // .avi
  'video/mkv',       // .mkv
]);

// Maximum file sizes for different formats (Deepgram can handle large files)
export const MAX_AUDIO_SIZE = parseInt(process.env.MAX_AUDIO_SIZE_MB || '500') * 1024 * 1024; // 500MB
export const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE_MB || '1000') * 1024 * 1024; // 1GB

export interface MediaValidationResult {
  isValid: boolean;
  format: 'audio' | 'video';
  mimeType: string;
  fileSize: number;
  recommendedAction: 'transcribe_directly' | 'extract_audio_first' | 'reject';
  errorMessage?: string;
}

/**
 * Validates and determines the best processing approach for audio/video files
 */
export function validateMediaFile(
  buffer: Buffer,
  mimeType: string,
  fileSize: number
): MediaValidationResult {
  logger.info("Validating media file", {
    mimeType,
    fileSize,
    sizeMB: Math.round(fileSize / (1024 * 1024))
  });

  // Check file size limits
  if (SUPPORTED_AUDIO_FORMATS.has(mimeType)) {
    if (fileSize > MAX_AUDIO_SIZE) {
      return {
        isValid: false,
        format: 'audio',
        mimeType,
        fileSize,
        recommendedAction: 'reject',
        errorMessage: `Audio file too large: ${(fileSize / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${MAX_AUDIO_SIZE / (1024 * 1024)}MB`
      };
    }

    return {
      isValid: true,
      format: 'audio',
      mimeType,
      fileSize,
      recommendedAction: 'transcribe_directly'
    };
  }

  if (SUPPORTED_VIDEO_FORMATS.has(mimeType)) {
    if (fileSize > MAX_VIDEO_SIZE) {
      return {
        isValid: false,
        format: 'video',
        mimeType,
        fileSize,
        recommendedAction: 'reject',
        errorMessage: `Video file too large: ${(fileSize / (1024 * 1024)).toFixed(1)}MB exceeds limit of ${MAX_VIDEO_SIZE / (1024 * 1024)}MB`
      };
    }

    // Deepgram can handle video files directly, but we might want to extract audio for efficiency
    // For now, we'll transcribe directly since Deepgram handles video well
    return {
      isValid: true,
      format: 'video',
      mimeType,
      fileSize,
      recommendedAction: 'transcribe_directly'
    };
  }

  return {
    isValid: false,
    format: mimeType.startsWith('audio/') ? 'audio' : 'video',
    mimeType,
    fileSize,
    recommendedAction: 'reject',
    errorMessage: `Unsupported media format: ${mimeType}`
  };
}

/**
 * Gets basic information about supported media formats
 */
export function getSupportedFormats() {
  return {
    audio: Array.from(SUPPORTED_AUDIO_FORMATS),
    video: Array.from(SUPPORTED_VIDEO_FORMATS),
    limits: {
      maxAudioSizeMB: MAX_AUDIO_SIZE / (1024 * 1024),
      maxVideoSizeMB: MAX_VIDEO_SIZE / (1024 * 1024)
    }
  };
}

/**
 * Checks if a MIME type is supported for transcription
 */
export function isMediaFormatSupported(mimeType: string): boolean {
  return SUPPORTED_AUDIO_FORMATS.has(mimeType) || SUPPORTED_VIDEO_FORMATS.has(mimeType);
}
