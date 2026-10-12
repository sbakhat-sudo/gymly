import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/** Minimal RFC 4180 field escaping: wrap in quotes and double up any quote inside. */
function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

/**
 * Web triggers a real file download. Native writes an actual `.csv` file to the cache directory
 * and hands it to the OS share sheet — Share.share() with raw text was previously used here, but
 * iOS/Android then treat it as a plain-text message, not a file: no "Open in Excel", no real
 * `.csv` saved anywhere. A real file on disk, shared with the `text/csv` MIME type, is what makes
 * "Save to Files" / "Open in Excel" actually show up.
 */
export async function exportCsv(filename: string, headers: string[], rows: string[][]): Promise<void> {
  const csv = toCsv(headers, rows);
  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const { isAvailableAsync, shareAsync } = await import('expo-sharing');
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);
  if (await isAvailableAsync()) {
    await shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: filename });
  }
}
