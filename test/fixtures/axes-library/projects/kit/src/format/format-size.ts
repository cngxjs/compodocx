/**
 * Formats a byte count for display.
 *
 * @param bytes Number of bytes.
 */
export function formatSize(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}
