import { Platform } from 'react-native';

// Limit file reads before parsing. Backups stay on the device; no network calls.
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const checkSize = (size: number) => {
  if (size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
};

export async function saveBackupFile(serialized: string): Promise<void> {
  const name = `clear-access-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('File sharing is unavailable on this device. No backup was saved.');
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, name);
  try {
    file.write(serialized);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your personal planner backup',
    });
  } finally {
    if (file.exists) file.delete();
  }
}

export async function pickBackupFile(): Promise<{ name: string; serialized: string } | null> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';
      const cleanup = () => input.remove();
      input.oncancel = () => { cleanup(); resolve(null); };
      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) { resolve(null); return; }
          checkSize(file.size);
          resolve({ name: file.name, serialized: await file.text() });
        } catch (error) { reject(error); }
        finally { cleanup(); }
      };
      document.body.appendChild(input);
      input.click();
    });
  }
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const { File } = await import('expo-file-system');
  const file = new File(asset.uri);
  try {
    checkSize(asset.size ?? file.size);
    return { name: asset.name, serialized: await file.text() };
  } finally {
    if (file.exists) file.delete();
  }
}