/**
 * Utility functions for MIME type detection and handling
 */

export function guessMimeTypeFromExtension(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop();
  
  const mimeMap: Record<string, string> = {
    'txt': 'text/plain',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc': 'application/msword',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'csv': 'text/csv',
    'pdf': 'application/pdf',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif'
  };
  
  return mimeMap[extension || ''] || 'application/octet-stream';
}

export function isTextFile(mimeType: string): boolean {
  return mimeType === 'text/plain' || mimeType === 'text/plain; charset=utf-8';
}

export function isDocxFile(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

export function isXlsxFile(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

export function isPptxFile(mimeType: string): boolean {
  return mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
}

export function isCsvFile(mimeType: string): boolean {
  return (
    mimeType === 'text/csv' ||
    mimeType === 'application/csv' ||
    mimeType === 'application/vnd.ms-excel'
  );
}

export function isAudioFile(mimeType: string): boolean {
  return mimeType?.startsWith('audio/');
}

export function isVideoFile(mimeType: string): boolean {
  return mimeType?.startsWith('video/');
}

export function isPdfFile(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}
