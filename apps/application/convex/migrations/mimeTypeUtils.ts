/**
 * MIME Type Utilities for Migration
 * 
 * Provides proper MIME type detection from file extensions and validation.
 */

/**
 * Maps file extensions to their proper MIME types
 */
const MIME_TYPE_MAP: Record<string, string> = {
  // Documents
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'rtf': 'application/rtf',
  'txt': 'text/plain',
  'odt': 'application/vnd.oasis.opendocument.text',
  
  // Spreadsheets
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ods': 'application/vnd.oasis.opendocument.spreadsheet',
  'csv': 'text/csv',
  
  // Presentations
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'odp': 'application/vnd.oasis.opendocument.presentation',
  
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'tiff': 'image/tiff',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  
  // Archives
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  
  // Audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
  
  // Video
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'wmv': 'video/x-ms-wmv',
  'flv': 'video/x-flv',
  'webm': 'video/webm',
  
  // Other
  'json': 'application/json',
  'xml': 'application/xml',
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'ts': 'application/typescript',
};

/**
 * Detects MIME type from file extension
 * @param fileName - The file name or path
 * @returns The proper MIME type or 'application/octet-stream' as fallback
 */
export function detectMimeTypeFromFileName(fileName: string): string {
  if (!fileName) {
    return 'application/octet-stream';
  }
  
  // Extract file extension
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return 'application/octet-stream';
  }
  
  const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  return MIME_TYPE_MAP[extension] || 'application/octet-stream';
}

/**
 * Detects MIME type from file type (legacy Firestore field)
 * @param fileType - The file type from Firestore
 * @returns The proper MIME type or 'application/octet-stream' as fallback
 */
export function detectMimeTypeFromFileType(fileType: string): string {
  if (!fileType) {
    return 'application/octet-stream';
  }
  
  // Handle common cases where fileType might already be a MIME type
  if (fileType.includes('/')) {
    return fileType;
  }
  
  // Map common file type strings to MIME types
  const fileTypeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'mp3': 'audio/mpeg',
    'mp4': 'video/mp4',
    'zip': 'application/zip',
  };
  
  const normalizedFileType = fileType.toLowerCase();
  return fileTypeMap[normalizedFileType] || 'application/octet-stream';
}

/**
 * Validates if a MIME type is supported
 * @param mimeType - The MIME type to validate
 * @returns True if the MIME type is supported
 */
export function isValidMimeType(mimeType: string): boolean {
  if (!mimeType || typeof mimeType !== 'string') {
    return false;
  }
  
  // Check if it's a valid MIME type format
  const mimeTypeRegex = /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*$/;
  return mimeTypeRegex.test(mimeType);
}

/**
 * Gets a safe MIME type, falling back to 'application/octet-stream' if invalid
 * @param mimeType - The MIME type to validate
 * @returns A valid MIME type
 */
export function getSafeMimeType(mimeType: string): string {
  if (isValidMimeType(mimeType)) {
    return mimeType;
  }
  return 'application/octet-stream';
}
