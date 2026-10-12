// Native I/O is injected so cancellation and storage failures can be exercised
// without pretending that a Node test has opened a real device's share sheet.
export interface BackupFile {
  uri: string;
  exists: boolean;
  size: number | null;
  write(value: string): void;
  text(): Promise<string>;
  delete(): void;
}

export interface NativeBackupIO {
  cacheUri: string;
  exportFile(name: string): BackupFile;
  openFile(uri: string): BackupFile;
  isSharingAvailable(): Promise<boolean>;
  share(uri: string, options: { mimeType: string; UTI: string; dialogTitle: string }): Promise<void>;
  pick(options: { type: string; copyToCacheDirectory: boolean; multiple: boolean }): Promise<{
    canceled: boolean;
    assets: { uri: string; name: string; size?: number }[] | null;
  }>;
}

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export function checkBackupSize(size: number) {
  if (size > MAX_BACKUP_BYTES) throw new Error('Choose a backup smaller than 10 MB.');
}

// React Native need not provide TextEncoder. Count UTF-8 bytes, including emoji.
export function checkBackupText(serialized: string) {
  let bytes = 0;
  for (const character of serialized) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    checkBackupSize(bytes);
  }
}

function removeOwnedFile(file: BackupFile) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Cleanup must not mask a failed write/read or turn a valid preview into
    // an error. Do not log personal filenames or file contents.
    console.warn('A temporary backup file could not be removed from the app cache.');
  }
}

export async function saveNativeBackup(serialized: string, name: string, io: NativeBackupIO) {
  checkBackupText(serialized);
  if (!await io.isSharingAvailable()) {
    throw new Error('File sharing is unavailable on this device. No backup was saved.');
  }
  const file = io.exportFile(name);
  try {
    file.write(serialized);
  } catch (error) {
    removeOwnedFile(file);
    throw error;
  }
  // Expo resolves on Android activity return / iOS sheet dismissal, not a
  // durable destination write. Even a rejection may follow a URI handoff.
  // Keep exposed exports in OS-managed cache, rather than racing a recipient
  // by deleting them in finally or after an arbitrary timeout.
  await io.share(file.uri, {
    mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save your personal planner backup',
  });
}

function isPickerCacheCopy(uri: string, cacheUri: string) {
  const prefix = `${cacheUri.replace(/\/+$/, '')}/DocumentPicker/`;
  // Only Expo's copied picker files belong to us; never delete a destination
  // or a provider URI if an unexpected picker response returns the original.
  return uri.startsWith(prefix) && !/%2e|%2f|%5c|\\|\.\./i.test(uri.slice(prefix.length));
}

export async function pickNativeBackup(io: NativeBackupIO): Promise<{ name: string; serialized: string } | null> {
  const result = await io.pick({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) throw new Error('The file picker did not return a backup. Please choose the file again.');
  const file = io.openFile(asset.uri);
  try {
    checkBackupSize(Math.max(asset.size ?? 0, file.size ?? 0));
    const serialized = await file.text();
    checkBackupText(serialized);
    return { name: asset.name, serialized };
  } finally {
    if (isPickerCacheCopy(file.uri, io.cacheUri)) removeOwnedFile(file);
  }
}