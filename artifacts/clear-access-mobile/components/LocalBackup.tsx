import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, ErrorBox, Eyebrow, Muted } from './ui';
import { usePlanner } from '@/contexts/PlannerProvider';
import {
  exportLocalBackup, previewLocalBackup, restoreLocalBackup, canUndoLocalRestore, undoLocalRestore,
  getLocalPeople, getLocalBackupSummary,
  getListPeopleQueryKey, LOCAL_PLANNER_QUERY_PREFIXES,
} from '@/lib/local-api';
import { pickBackupFile, saveBackupFile } from '@/lib/backup-file';

type Preview = ReturnType<typeof previewLocalBackup>;
type Pending = { name: string; serialized: string; incoming: Preview; current: Preview };
const totals = (preview: Preview) =>
  `${preview.people.length} people · ${preview.foods} foods · ${preview.entries} meals · ${preview.activities} activities · ${preview.heightRecords} height records · ${preview.weightRecords} weigh-ins`;

export function LocalBackup() {
  const c = useColors();
  const client = useQueryClient();
  const { selectPerson } = usePlanner();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canUndoRestore, setCanUndoRestore] = useState(false);
  const [undoStatusChecked, setUndoStatusChecked] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const failed = (problem: unknown) => setError(problem instanceof Error ? problem : new Error(String(problem)));
  const isPlannerQuery = (query: { queryKey: readonly unknown[] }) =>
    LOCAL_PLANNER_QUERY_PREFIXES.some(prefix => query.queryKey[0] === prefix);

  useEffect(() => {
    let mounted = true;
    void canUndoLocalRestore()
      .then(available => { if (mounted) setCanUndoRestore(available); })
      .catch(problem => { if (mounted) failed(problem); })
      .finally(() => { if (mounted) setUndoStatusChecked(true); });
    return () => { mounted = false; };
  }, []);

  async function refreshPlannerAfterReplacement() {
    const people = await getLocalPeople();
    const activePerson = people.find(person => person.isDefault) ?? people[0];
    if (!activePerson) throw new Error('The restored planner has no profiles to select.');
    client.setQueryData(getListPeopleQueryKey(), people);
    selectPerson(activePerson.id);
    await client.invalidateQueries({ predicate: isPlannerQuery });
  }

  async function exportFile() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await saveBackupFile(await exportLocalBackup());
      setNotice(result === 'saved'
        ? Platform.OS === 'android' ? 'Backup saved to the selected folder.' : 'Backup file download started.'
        : result === 'shared' ? 'Share sheet closed.' : 'Export cancelled. No file was saved.');
    } catch (problem) { failed(problem); }
    finally { setBusy(false); }
  }

  async function chooseFile() {
    setBusy(true); setError(null); setNotice(null); setPending(null); setConfirmUndo(false);
    try {
      const file = await pickBackupFile();
      if (!file) return;
      const incoming = previewLocalBackup(file.serialized);
      const current = await getLocalBackupSummary();
      setPending({ ...file, incoming, current });
    } catch (problem) { failed(problem); }
    finally { setBusy(false); }
  }

  async function restore() {
    if (!pending || busy) return;
    setBusy(true); setError(null);
    try {
      // Prevent an in-flight read from publishing old data after replacement.
      await client.cancelQueries({ predicate: isPlannerQuery });
      await restoreLocalBackup(pending.serialized);
    } catch (problem) {
      failed(problem); setBusy(false); return;
    }
    setPending(null);
    setCanUndoRestore(true);
    setUndoStatusChecked(true);
    setConfirmUndo(false);
    try {
      await refreshPlannerAfterReplacement();
      setNotice('Backup restored. You can undo this replacement from this screen.');
    } catch {
      setError(new Error('Backup was restored, but the screen could not refresh. Reopen the app to view the restored records.'));
    } finally { setBusy(false); }
  }

  async function undoRestore() {
    if (busy || pending || !canUndoRestore) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await client.cancelQueries({ predicate: isPlannerQuery });
      const result = await undoLocalRestore();
      setCanUndoRestore(!result.snapshotCleared);
      setConfirmUndo(false);
      try {
        await refreshPlannerAfterReplacement();
        setNotice(result.snapshotCleared
          ? 'Previous planner restored. The recovery copy has been cleared.'
          : 'Previous planner restored. Its recovery copy could not be cleared and may remain available.');
      } catch {
        setError(new Error('Previous planner was restored, but the screen could not refresh. Reopen the app to view the records.'));
      }
    } catch (problem) {
      failed(problem);
    } finally {
      setBusy(false);
    }
  }

  return <Card>
    <Eyebrow>Local backup & restore</Eyebrow>
    <Muted>Back up everyone on this device, including foods, meals, activities, personal settings, dated height history and weigh-ins. No sign-in, automatic cloud sync or server upload.</Muted>
    <Muted>This unencrypted file contains personal information: names, birth dates, body measurements and nutrition records. Choose a trusted folder or recipient. On Android, export offers Save to device or Share with another app. Clearing storage or uninstalling can erase the records on this device.</Muted>
    <Muted>After a restore, one copy of the planner from immediately before it is kept on this device only. A later restore replaces that recovery copy.</Muted>
    <Btn label="Export full backup" icon="download" disabled={busy || !!pending} testID="button-export-backup" onPress={() => void exportFile()} />
    <Btn label="Choose backup to restore" icon="upload" variant="ghost" disabled={busy} testID="button-import-backup" onPress={() => void chooseFile()} />
    {pending ? <View testID="backup-restore-preview" style={{ gap: 10 }}>
      <Eyebrow>Review before replacing</Eyebrow>
      <Muted>File: {pending.name}</Muted>
      <Muted>Created: {pending.incoming.createdAt}</Muted>
      <Text style={{ fontFamily: 'Inter_700Bold' }}>From backup: {totals(pending.incoming)}</Text>
      {pending.incoming.people.map(person => <Muted key={person.id}>{person.name}: {person.entries} meals, {person.activities} activities, {person.heightRecords} height records, {person.weightRecords} weigh-ins; saved personal settings included.</Muted>)}
      <Muted>Currently on this device: {totals(pending.current)}</Muted>
      <Muted>People being replaced: {pending.current.people.map(person => person.name).join(', ')}.</Muted>
      <Text style={{ fontFamily: 'Inter_700Bold', color: c.destructive }}>Replace ALL local planner records with this backup? This does not merge records. The app will first save a local recovery copy; if it cannot, the restore will not proceed.</Text>
      <Btn label="Replace all records & restore" icon="alert-triangle" variant="danger" loading={busy} testID="button-confirm-restore" onPress={() => void restore()} />
      <Btn label="Cancel — keep current records" variant="ghost" disabled={busy} testID="button-cancel-restore" onPress={() => { setPending(null); setError(null); }} />
    </View> : null}
    {undoStatusChecked && canUndoRestore ? <View testID="backup-restore-undo" style={{ gap: 10 }}>
      <Eyebrow>Previous planner available</Eyebrow>
      <Muted>Undo replaces all current planner records with the copy saved before the latest restore. Any changes made since that restore will also be removed.</Muted>
      {confirmUndo ? <>
        <Text style={{ fontFamily: 'Inter_700Bold', color: c.destructive }}>Replace the current planner with the saved previous planner?</Text>
        <Btn label="Confirm undo and replace current planner" icon="rotate-ccw" variant="danger" loading={busy} testID="button-confirm-restore-undo" onPress={() => void undoRestore()} />
        <Btn label="Cancel undo" variant="ghost" disabled={busy} testID="button-cancel-restore-undo" onPress={() => setConfirmUndo(false)} />
      </> : <Btn label="Undo last restore" icon="rotate-ccw" variant="ghost" disabled={busy || !!pending} testID="button-start-restore-undo" onPress={() => { setError(null); setNotice(null); setConfirmUndo(true); }} />}
    </View> : null}
    {busy && !pending && !confirmUndo ? <Muted>Preparing backup…</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID="status-backup" style={{ fontFamily: 'Inter_600SemiBold', color: c.primary }}>{notice}</Text> : null}
  </Card>;
}