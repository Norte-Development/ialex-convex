import { useBillingLimit } from "./useBillingLimit";

/**
 * Hook to check if a file can be uploaded based on storage limits
 * 
 * @param fileSize - Optional file size in bytes
 * @returns Storage check result with available space information
 */
export function useStorageCheck(fileSize?: number) {
  const { allowed, reason, currentCount, limit } = useBillingLimit("storage", {
    additionalBytes: fileSize,
  });

  const availableGB = limit !== Infinity && limit !== undefined
    ? ((limit - (currentCount || 0)) / (1024 * 1024 * 1024)).toFixed(2)
    : "∞";

  return {
    allowed,
    reason,
    availableGB,
    totalUsedGB: ((currentCount || 0) / (1024 * 1024 * 1024)).toFixed(2),
    totalLimitGB: limit === Infinity || limit === undefined ? "∞" : (limit / (1024 * 1024 * 1024)).toFixed(0),
  };
}

/**
 * Format file size in human-readable format
 * 
 * @param bytes - File size in bytes
 * @returns Formatted file size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  
  const k = 1024;
  const sizes: Array<string> = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

