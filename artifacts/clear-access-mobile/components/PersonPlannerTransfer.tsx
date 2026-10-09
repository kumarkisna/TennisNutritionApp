import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  exportLocalPersonPlanner,
  importLocalPersonPlanner,
  LOCAL_PLANNER_QUERY_PREFIXES,
  previewLocalPersonPlannerImport,
  type Person,
  type PersonPlannerImportPreview,
} from '@/lib/local-api';
import {
  pickPersonPlannerFile,
  savePersonPlannerFile,
} from '@/lib/backup-file';
import { Btn, Card, ErrorBox, Eyebrow, F, Muted } from './ui';

type PendingFile = { name: string; serialized: string; preview: PersonPlannerImportPreview };
const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function PersonPlannerExportButton({ person }: { person: Person }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function exportPerson() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await savePersonPlannerFile(await exportLocalPersonPlanner(person.id));
      setNotice(result === 'saved'
        ? Platform.OS === 'android' ? 'Planner file saved to the selected folder.' : 'Planner file download started.'
        : result === 'shared' ? 'Share sheet closed.' : 'Export cancelled. No file was saved.');
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  return <View style={{ gap: 6 }}>
    <Btn small icon="download" label="Export" disabled={busy} loading={busy} testID={`button-export-person-${person.id}`} onPress={() => void exportPerson()} />
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID={`status-export-person-${person.id}`} style={{ fontFamily: F.semi, fontSize: 12, color: c.primary }}>{notice}</Text> : null}
  </View>;
}

export function PersonPlannerImport() {
  const c = useColors();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [importName, setImportName] = useState('');
  const [targetPersonId, setTargetPersonId] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isPlannerQuery = (query: { queryKey: readonly unknown[] }) =>
    LOCAL_PLANNER_QUERY_PREFIXES.some(prefix => query.queryKey[0] === prefix);

  async function chooseFile() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setPending(null);
    setTargetPersonId(null);
    try {
      const file = await pickPersonPlannerFile();
      if (!file) return;
      const preview = await previewLocalPersonPlannerImport(file.serialized);
      setPending({ ...file, preview });
      setImportName(preview.suggestedName);
      setTargetPersonId(preview.matchedPerson?.id ?? null);
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  async function importPerson() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.cancelQueries({ predicate: isPlannerQuery });
      const result = await importLocalPersonPlanner(pending.serialized, importName, targetPersonId ?? undefined);
      setPending(null);
      try {
        await client.invalidateQueries({ predicate: isPlannerQuery });
        setNotice(`${result.person.name} was ${result.matchedExisting ? 'restored to the existing profile' : 'added as a new profile'} with ${countLabel(result.entriesImported, 'meal', 'meals')}, ${countLabel(result.activitiesImported, 'planned day', 'planned days')}, ${countLabel(result.heightRecordsImported, 'height record', 'height records')}, ${countLabel(result.weightRecordsImported, 'weigh-in', 'weigh-ins')}, and ${countLabel(result.foodsImported, 'new food', 'new foods')}.`);
      } catch {
        setError(new Error('The person was imported, but the planner could not refresh. Reopen the People screen to view the new profile.'));
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  const preview = pending?.preview;
  const selectedPerson = preview?.matchedPerson?.id === targetPersonId
    ? preview.matchedPerson
    : preview?.sameNamePerson?.id === targetPersonId
      ? preview.sameNamePerson
      : null;
  return <Card style={{ gap: 10 }}>
    <Eyebrow>Move one person’s planner</Eyebrow>
    <Muted>Export one profile from its card, or import a person file here. Matching backup IDs restore to the same profile. A first import can be linked to an existing profile; existing settings and records are not replaced.</Muted>
    <Muted>A person file includes their profile, saved meals, dated activity, height records and weigh-ins, and foods used by those meals. Other people’s plans are not included.</Muted>
    <Btn icon="upload" label="Import person file" variant="ghost" disabled={busy} testID="button-import-person-planner" onPress={() => void chooseFile()} />
    {preview ? <View testID="person-import-preview" style={{ gap: 8 }}>
      <Eyebrow>Review before importing</Eyebrow>
      <Muted>File: {pending.name}</Muted>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>From: {preview.personName}</Text>
      <Muted>{countLabel(preview.entries, 'meal', 'meals')} · {countLabel(preview.activities, 'planned day', 'planned days')} · {countLabel(preview.heightRecords, 'height record', 'height records')} · {countLabel(preview.weightRecords, 'weigh-in', 'weigh-ins')} · {countLabel(preview.foods, 'food record', 'food records')}</Muted>
      {selectedPerson ? <Muted>{preview.matchedPerson?.id === selectedPerson.id
        ? `Backup ID matched ${selectedPerson.name}. Missing records will be added to this profile.`
        : `Will restore into ${selectedPerson.name}. Existing settings and records stay unchanged.`}</Muted> : null}
      {!selectedPerson && preview.sameNamePerson ? <View style={{ gap: 6 }}>
        <Muted>The name matches an existing profile, but the backup IDs differ. Choose that profile if this is the same person, or import separately.</Muted>
        <Btn small label={`Restore into ${preview.sameNamePerson.name}`} variant="ghost" testID="button-link-person-import" onPress={() => setTargetPersonId(preview.sameNamePerson!.id)} />
      </View> : null}
      {selectedPerson && !preview.matchedPerson && preview.sameNamePerson
        ? <Btn small label="Import separately instead" variant="ghost" testID="button-unlink-person-import" onPress={() => setTargetPersonId(null)} />
        : null}
      {!selectedPerson && !preview.hasStableIdentity ? <Muted>This older file has no stable backup ID, so it cannot be matched automatically.</Muted> : null}
      {!selectedPerson ? <>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>Name for the new profile</Text>
        <TextInput
          testID="input-import-person-name"
          value={importName}
          onChangeText={setImportName}
          placeholder="Enter a name"
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="words"
          maxLength={80}
          style={{ minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, borderColor: c.input, backgroundColor: c.card, fontFamily: F.medium, fontSize: 15, color: c.foreground }}
        />
      </> : null}
      <Muted>Matching foods are reused. New foods are added to the shared library. Existing settings and records are preserved.</Muted>
      <Btn icon="check" label={selectedPerson ? 'Restore to existing person' : 'Import as new person'} loading={busy} disabled={!selectedPerson && !importName.trim()} testID="button-confirm-import-person" onPress={() => void importPerson()} />
      <Btn variant="ghost" label="Cancel" disabled={busy} testID="button-cancel-import-person" onPress={() => { setPending(null); setError(null); }} />
    </View> : null}
    {busy && !pending ? <Muted>Preparing person file…</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID="status-import-person" style={{ fontFamily: F.semi, color: c.primary }}>{notice}</Text> : null}
  </Card>;
}