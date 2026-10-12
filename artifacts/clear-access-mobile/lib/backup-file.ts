import { Alert, Platform } from 'react-native';
import { checkBackupSize, checkBackupText, pickNativeBackup, saveNativeBackup, type NativeBackupIO } from './native-backup-file';

// Limit imported files before parsing. Transfers are local unless the user chooses to share.
export type JsonFileSaveResult = 'saved' | 'shared' | 'cancelled';

async function nativeIO(): Promise<NativeBackupIO> {
  const [Sharing, DocumentPicker, { File, Paths }] = await Promise.all([
    import('expo-sharing'), import('expo-document-picker'), import('expo-file-system'),
  ]);
  return {
    cacheUri: Paths.cache.uri,
    // Sharing needs a local URI. Keep its source in the OS-managed cache rather
    // than persistent Documents storage; native handoff completion is not proof
    // that the receiving app has finished copying it.
    exportFile: name => new File(Paths.cache, name),
    openFile: uri => new File(uri),
    isSharingAvailable: Sharing.isAvailableAsync,
    share: Sharing.shareAsync,
    pick: DocumentPicker.getDocumentAsync,
  };
}

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
  await saveNativeBackup(serialized, name, await nativeIO());
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
  checkBackupText(serialized);
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
export const saveAllPeoplePlannerFile = (serialized: string) =>
  saveJsonFile(serialized, 'clear-access-all-people-planner', 'Save all people’s planner file');

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
          checkBackupSize(file.size);
          const serialized = await file.text();
          checkBackupText(serialized);
          resolve({ name: file.name, serialized });
        } catch (error) { reject(error); }
        finally { cleanup(); }
      };
      document.body.appendChild(input);
      input.click();
    });
  }
  return pickNativeBackup(await nativeIO());
}

export const pickBackupFile = pickJsonFile;
export const pickFoodLibraryFile = pickJsonFile;
export const pickPersonPlannerFile = pickJsonFile;
export const pickAllPeoplePlannerFile = pickJsonFile;
