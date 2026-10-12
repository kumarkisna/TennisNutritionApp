// @ts-ignore Direct Node regression suite; not bundled into the app.
import assert from 'node:assert/strict';
// @ts-ignore Direct Node regression suite; not bundled into the app.
import test from 'node:test';
import {
  MAX_BACKUP_BYTES, checkBackupText, pickNativeBackup, saveNativeBackup,
  type BackupFile, type NativeBackupIO,
} from './native-backup-file';
import { createLocalStore, type AsyncKeyValueStorage } from './local-store';

class MemoryFile implements BackupFile {
  exists = false;
  size: number | null = 0;
  value = '';
  deletes = 0;
  reads = 0;
  writeError: Error | null = null;
  readError: Error | null = null;
  deleteError: Error | null = null;
  constructor(public uri: string) {}
  write(value: string) {
    this.exists = true;
    if (this.writeError) throw this.writeError;
    this.value = value;
    this.size = value.length;
  }
  async text() {
    this.reads++;
    if (this.readError) throw this.readError;
    return this.value;
  }
  delete() {
    this.deletes++;
    if (this.deleteError) throw this.deleteError;
    this.exists = false;
  }
}

function harness() {
  const cacheUri = 'file:///app/cache/';
  const exported = new MemoryFile(`${cacheUri}backup.json`);
  const picked = new MemoryFile(`${cacheUri}DocumentPicker/copy.json`);
  picked.write('{"backup":true}');
  let shares = 0;
  let opens = 0;
  let available = true;
  let canceled = false;
  let shareError: Error | null = null;
  const io: NativeBackupIO = {
    cacheUri,
    exportFile: () => exported,
    openFile: () => { opens++; return picked; },
    isSharingAvailable: async () => available,
    share: async (uri, options) => {
      shares++;
      assert.equal(uri, exported.uri);
      assert.equal(exported.exists, true);
      assert.deepEqual(options, {
        mimeType: 'application/json', UTI: 'public.json',
        dialogTitle: 'Save your personal planner backup',
      });
      if (shareError) throw shareError;
    },
    pick: async options => {
      assert.deepEqual(options, { type: '*/*', copyToCacheDirectory: true, multiple: false });
      return canceled ? { canceled: true, assets: null } : {
        canceled: false, assets: [{ uri: picked.uri, name: 'saved.json', size: picked.size ?? undefined }],
      };
    },
  };
  return {
    io, exported, picked,
    shares: () => shares, opens: () => opens,
    unavailable: () => { available = false; },
    cancel: () => { canceled = true; },
    failShare: (error: Error) => { shareError = error; },
  };
}

test('a late recipient can copy and reopen the complete export after share resolves', async () => {
  const h = harness();
  const serialized = JSON.stringify({
    format: 'clear-access-backup',
    people: [{ id: 'person-1', name: 'Sample', meals: [{ slot: 'lunch', food: 'rice' }] }],
  });
  await saveNativeBackup(serialized, 'backup.json', h.io);
  assert.equal(h.shares(), 1);
  assert.equal(h.exported.deletes, 0);
  // Start the receiving-app copy only after the share promise has returned.
  h.picked.write(await h.exported.text());
  const reopened = await pickNativeBackup(h.io);
  assert.equal(reopened?.serialized, serialized);
  assert.deepEqual(JSON.parse(reopened!.serialized), JSON.parse(serialized));
  assert.equal(h.exported.exists, true, 'the app retains the handed-off source');
  assert.equal(h.exported.deletes, 0);
});

test('a rejected share retains any file already handed to the native sheet', async () => {
  const h = harness();
  const error = new Error('share unavailable after handoff');
  h.failShare(error);
  await assert.rejects(saveNativeBackup('{}', 'backup.json', h.io), (problem: unknown) => problem === error);
  assert.equal(h.exported.exists, true);
  assert.equal(h.exported.deletes, 0);
});

test('unavailable sharing writes no temporary file and does not attempt a share', async () => {
  const h = harness();
  h.unavailable();
  await assert.rejects(saveNativeBackup('{}', 'backup.json', h.io), /No backup was saved/);
  assert.equal(h.exported.exists, false);
  assert.equal(h.shares(), 0);
});

test('a full export cache cleans partial writes without opening the share sheet', async () => {
  const h = harness();
  const error = new Error('disk full');
  h.exported.writeError = error;
  await assert.rejects(saveNativeBackup('{}', 'backup.json', h.io), (problem: unknown) => problem === error);
  assert.equal(h.exported.exists, false);
  assert.equal(h.shares(), 0);
});

test('cleanup failure preserves the original export write failure', async () => {
  const h = harness();
  const error = new Error('disk full');
  h.exported.writeError = error;
  h.exported.deleteError = new Error('delete denied');
  await assert.rejects(saveNativeBackup('{}', 'backup.json', h.io), (problem: unknown) => problem === error);
  assert.equal(h.shares(), 0);
});

test('picker cancellation opens and deletes nothing', async () => {
  const h = harness();
  h.cancel();
  assert.equal(await pickNativeBackup(h.io), null);
  assert.equal(h.opens(), 0);
  assert.equal(h.picked.deletes, 0);
});

test('selected cache copy is read completely before deletion', async () => {
  const h = harness();
  assert.deepEqual(await pickNativeBackup(h.io), { name: 'saved.json', serialized: '{"backup":true}' });
  assert.equal(h.picked.reads, 1);
  assert.equal(h.picked.exists, false);
});

test('picker read failure cleans only the temporary copy and reports the read failure', async () => {
  const h = harness();
  const error = new Error('provider unavailable offline');
  h.picked.readError = error;
  h.picked.deleteError = new Error('delete denied');
  await assert.rejects(pickNativeBackup(h.io), (problem: unknown) => problem === error);
  assert.equal(h.picked.deletes, 1);
});

test('cleanup failure does not discard successfully read preview contents', async () => {
  const h = harness();
  h.picked.deleteError = new Error('delete denied');
  assert.equal((await pickNativeBackup(h.io))?.serialized, '{"backup":true}');
});

for (const uri of [
  'content://provider/saved.json',
  'file:///storage/Downloads/saved.json',
  'file:///app/cache-other/DocumentPicker/saved.json',
  'file:///app/cache/DocumentPicker/../saved.json',
  'file:///app/cache/DocumentPicker/%2e%2e/saved.json',
]) {
  test(`never deletes a selected original or unexpected path: ${uri}`, async () => {
    const h = harness();
    h.picked.uri = uri;
    await pickNativeBackup(h.io);
    assert.equal(h.picked.deletes, 0);
    assert.equal(h.picked.exists, true);
  });
}

test('file size uses actual cache-copy size even if picker metadata understates it', async () => {
  const h = harness();
  h.picked.size = MAX_BACKUP_BYTES + 1;
  h.io.pick = async () => ({
    canceled: false, assets: [{ uri: h.picked.uri, name: 'large.json', size: 1 }],
  });
  await assert.rejects(pickNativeBackup(h.io), /10 MB/);
  assert.equal(h.picked.reads, 0);
  assert.equal(h.picked.exists, false);
});

test('missing picker asset and provider-copy failures are explicit and do not delete originals', async () => {
  const h = harness();
  h.io.pick = async () => ({ canceled: false, assets: [] });
  await assert.rejects(pickNativeBackup(h.io), /did not return a backup/);
  const error = new Error('cannot copy provider file');
  h.io.pick = async () => { throw error; };
  await assert.rejects(pickNativeBackup(h.io), (problem: unknown) => problem === error);
  assert.equal(h.opens(), 0);
  assert.equal(h.picked.deletes, 0);
});

test('UTF-8 limit prevents offering an export that cannot be reopened', async () => {
  assert.doesNotThrow(() => checkBackupText('a'.repeat(MAX_BACKUP_BYTES)));
  assert.throws(() => checkBackupText('😀'.repeat(MAX_BACKUP_BYTES / 4 + 1)), /10 MB/);
  const h = harness();
  await assert.rejects(saveNativeBackup('a'.repeat(MAX_BACKUP_BYTES + 1), 'backup.json', h.io), /10 MB/);
  assert.equal(h.exported.exists, false);
  h.picked.size = null;
  h.picked.value = 'é'.repeat(MAX_BACKUP_BYTES / 2 + 1);
  await assert.rejects(pickNativeBackup(h.io), /10 MB/);
  assert.equal(h.picked.exists, false);
});

class MemoryStorage implements AsyncKeyValueStorage {
  values = new Map<string, string>();
  fail = false;
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    if (this.fail) throw new Error('storage full');
    this.values.set(key, value);
  }
}

test('temporary-file cleanup failure cannot change planner records', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  await store.createPerson({ name: 'Saved profile', activityLevel: 'sedentary', baselineCalories: 2000 });
  const before = await store.exportForTests();
  const h = harness();
  const writeError = new Error('disk full');
  h.exported.writeError = writeError;
  h.exported.deleteError = new Error('delete denied');

  await assert.rejects(
    saveNativeBackup(await store.exportBackup(), 'backup.json', h.io),
    (problem: unknown) => problem === writeError,
  );
  assert.deepEqual(await store.exportForTests(), before);
});

test('export, native reopen, preview, failed restore, retry and reload require no network', async () => {
  const storage = new MemoryStorage();
  const store = createLocalStore(storage);
  await store.createPerson({ name: 'Saved profile', activityLevel: 'sedentary', baselineCalories: 2000 });
  const snapshot = await store.exportForTests();
  const h = harness();
  await saveNativeBackup(await store.exportBackup(), 'backup.json', h.io);
  // Model the destination copying and the picker reopening that saved file.
  // This tests app logic, not actual iOS Files / Android providers.
  h.picked.write(await h.exported.text());
  const selected = (await pickNativeBackup(h.io))!;
  const destinationStorage = new MemoryStorage();
  const destination = createLocalStore(destinationStorage);
  await destination.createPerson({ name: 'Current profile', activityLevel: 'sedentary', baselineCalories: 2000 });
  const original = await destination.exportForTests();
  const originalBytes = [...destinationStorage.values];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network forbidden'); };
  try {
    assert.equal(destination.previewBackup(selected.serialized).people.length, 2);
    assert.deepEqual(await destination.exportForTests(), original, 'preview cancellation is nondestructive');
    assert.throws(() => destination.previewBackup('{invalid'), /backup/i);
    await assert.rejects(destination.restoreBackup('{invalid'), /backup/i);
    destinationStorage.fail = true;
    await assert.rejects(destination.restoreBackup(selected.serialized), /restore was not applied/);
    assert.deepEqual([...destinationStorage.values], originalBytes);
    assert.deepEqual(await createLocalStore(destinationStorage).exportForTests(), original);
    destinationStorage.fail = false;
    await destination.restoreBackup(selected.serialized);
    assert.deepEqual(await createLocalStore(destinationStorage).exportForTests(), snapshot);
    assert.equal(h.exported.exists, true, 'picker cleanup cannot delete the exported source');
  } finally {
    globalThis.fetch = previousFetch;
  }
});