import { Alert, Platform } from 'react-native';

// Limit imported files before parsing. Transfers are local unless the user chooses to share.
const MAX_TRANSFER_BYTES = 10 * 1024 * 1024;
const checkSize = (size: number) => {
  if (size > MAX_TRANSFER_BYTES) throw new Error('Choose a file smaller than 10 MB.');
};

export type JsonFileSaveResult = 'saved' | 'shared' | 'cancelled';

function downloadJsonFile(serialized: string, name: string): void {
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareJsonFile(serialized: string, name: string, dialogTitle: string): Promise<void> {
  const Sharing = await import('expo-sharing');
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('File sharing is unavailable on this device. No file was saved.');
  }
  const { File, Paths } = await import('expo-file-system');
  const file = new File(Paths.cache, name);
  try {
    file.write(serialized);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json', UTI: 'public.json', dialogTitle,
    });
  } finally {
    if (file.exists) file.delete();
  }
}

type AndroidExportChoice = 'save' | 'share' | 'cancel';

function chooseAndroidExport(dialogTitle: string): Promise<AndroidExportChoice> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (choice: AndroidExportChoice) => {
      if (settled) return;
      settled = true;
      resolve(choice);
    };
    Alert.alert(
      dialogTitle,
      'Save to device opens the Android folder picker. Share sends the file to another app.',
      [
        { text: 'Save to device', onPress: () => finish('save') },
        { text: 'Share with another app', onPress: () => finish('share') },
        { text: 'Cancel', style: 'cancel', onPress: () => finish('cancel') },
      ],
      { cancelable: true, onDismiss: () => finish('cancel') },
    );
  });
}

async function saveJsonToAndroidFolder(serialized: string, name: string): Promise<JsonFileSaveResult> {
  const { StorageAccessFramework } = await import('expo-file-system/legacy');
  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return 'cancelled';

  // SAF adds the extension from the MIME type, so pass a name without ".json".
  const fileUri = await StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    name.replace(/\.json$/i, ''),
    'application/json',
  );
  await StorageAccessFramework.writeAsStringAsync(fileUri, serialized);
  return 'saved';
}

async function saveJsonFile(serialized: string, prefix: string, dialogTitle: string): Promise<JsonFileSaveResult> {
  const name = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  if (Platform.OS === 'web') {
    downloadJsonFile(serialized, name);
    return 'saved';
  }

  if (Platform.OS === 'android') {
    const choice = await chooseAndroidExport(dialogTitle);
    if (choice === 'cancel') return 'cancelled';
    if (choice === 'save') return saveJsonToAndroidFolder(serialized, name);
    await shareJsonFile(serialized, name, dialogTitle);
    return 'shared';
  }

  await shareJsonFile(serialized, name, dialogTitle);
  return 'shared';
}

export const saveBackupFile = (serialized: string) =>
  saveJsonFile(serialized, 'clear-access-backup', 'Save your personal planner backup');
export const saveFoodLibraryFile = (serialized: string) =>
  saveJsonFile(serialized, 'clear-access-foods', 'Save your food library');
export const savePersonPlannerFile = (serialized: string) =>
  saveJsonFile(serialized, 'clear-access-person-planner', 'Save this person’s planner file');

async function pickJsonFile(): Promise<{ name: string; serialized: string } | null> {
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
  if (!asset) return null;
  const FileSystem = await import('expo-file-system/legacy');
  try {
    let size = asset.size;
    if (size === undefined || size < 0) {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (!info.exists) throw new Error('The selected file is no longer available. Choose it again.');
      size = info.size;
    }
    checkSize(size);
    return { name: asset.name, serialized: await FileSystem.readAsStringAsync(asset.uri) };
  } finally {
    const cacheDirectory = FileSystem.cacheDirectory;
    if (cacheDirectory && asset.uri.startsWith(cacheDirectory)) {
      await FileSystem.deleteAsync(asset.uri, { idempotent: true }).catch(() => {});
    }
  }
}

export const pickBackupFile = pickJsonFile;
export const pickFoodLibraryFile = pickJsonFile;
export const pickPersonPlannerFile = pickJsonFile;