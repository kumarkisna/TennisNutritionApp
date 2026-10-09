import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  exportLocalAllPeoplePlanner,
  importLocalAllPeoplePlanner,
  LOCAL_PLANNER_QUERY_PREFIXES,
  previewLocalAllPeoplePlannerImport,
  type AllPeoplePlannerImportPreview,
} from '@/lib/local-api';
import {
  pickAllPeoplePlannerFile,
  saveAllPeoplePlannerFile,
} from '@/lib/backup-file';
import { Btn, Card, ErrorBox, Eyebrow, F, Muted } from './ui';

type PendingFile = {
  name: string;
  serialized: string;
  preview: AllPeoplePlannerImportPreview;
};

const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function AllPeoplePlannerTransfer() {
  const c = useColors();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [importNames, setImportNames] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isPlannerQuery = (query: { queryKey: readonly unknown[] }) =>
    LOCAL_PLANNER_QUERY_PREFIXES.some(prefix => query.queryKey[0] === prefix);

  async function exportPeople() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveAllPeoplePlannerFile(await exportLocalAllPeoplePlanner());
      setNotice(result === 'saved'
        ? Platform.OS === 'android' ? 'All-people file saved to the selected folder.' : 'All-people file download started.'
        : result === 'shared' ? 'Share sheet closed.' : 'Export cancelled. No file was saved.');
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setPending(null);
    try {
      const file = await pickAllPeoplePlannerFile();
      if (!file) return;
      const preview = await previewLocalAllPeoplePlannerImport(file.serialized);
      setPending({ ...file, preview });
      setImportNames(preview.people.map(person => person.suggestedName));
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  async function importPeople() {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      await client.cancelQueries({ predicate: isPlannerQuery });
      const result = await importLocalAllPeoplePlanner(pending.serialized, importNames);
      setPending(null);
      try {
        await client.invalidateQueries({ predicate: isPlannerQuery });
        setNotice(
          `${countLabel(result.people.length, 'person', 'people')} added with ` +
          `${countLabel(result.entriesImported, 'meal', 'meals')}, ` +
          `${countLabel(result.activitiesImported, 'planned day', 'planned days')}, ` +
          `${countLabel(result.heightRecordsImported, 'height record', 'height records')}, ` +
          `${countLabel(result.weightRecordsImported, 'weigh-in', 'weigh-ins')}, and ` +
          `${countLabel(result.foodsImported, 'new food', 'new foods')}.`,
        );
      } catch {
        setError(new Error('The people were imported, but the planner could not refresh. Reopen the People screen to view them.'));
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  const nameKeys = importNames.map(name => name.trim().toLocaleLowerCase());
  const hasInvalidNames = nameKeys.some(name => !name) || new Set(nameKeys).size !== nameKeys.length;
  const preview = pending?.preview;
  const mealCount = preview?.people.reduce((total, person) => total + person.entries, 0) ?? 0;
  const activityCount = preview?.people.reduce((total, person) => total + person.activities, 0) ?? 0;
  const heightCount = preview?.people.reduce((total, person) => total + person.heightRecords, 0) ?? 0;
  const weightCount = preview?.people.reduce((total, person) => total + person.weightRecords, 0) ?? 0;

  return <Card style={{ gap: 10 }}>
    <Eyebrow>Move everyone in one file</Eyebrow>
    <Muted>Exports all profiles on this device, their meals, activities, height and weight history, and foods used in those meals. Unused food-library items and device reminder settings are not included. Keep the file private.</Muted>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Btn icon="download" label="Export all people" disabled={busy} loading={busy} testID="button-export-all-people" onPress={() => void exportPeople()} />
      <Btn icon="upload" label="Import all-people file" variant="ghost" disabled={busy} testID="button-import-all-people" onPress={() => void chooseFile()} />
    </View>
    {preview ? <View testID="all-people-import-preview" style={{ gap: 9 }}>
      <Eyebrow>Review before importing</Eyebrow>
      <Muted>File: {pending.name}</Muted>
      <Muted>
        {countLabel(preview.people.length, 'profile', 'profiles')} · {countLabel(mealCount, 'meal', 'meals')} ·
        {' '}{countLabel(activityCount, 'planned day', 'planned days')} · {countLabel(heightCount, 'height record', 'height records')} ·
        {' '}{countLabel(weightCount, 'weigh-in', 'weigh-ins')} · {countLabel(preview.foods, 'food', 'foods')}
      </Muted>
      <Muted>Import adds these profiles and records. It does not replace existing people or plans. Matching foods are reused; other foods are added to the shared library.</Muted>
      {preview.people.map((person, index) => <View key={`${person.personName}-${index}`} style={{ gap: 5 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>
          {person.personName}{person.nameConflict ? ' · name conflict' : ''}
        </Text>
        <TextInput
          testID={`input-all-people-import-name-${index}`}
          value={importNames[index] ?? ''}
          onChangeText={value => setImportNames(current => current.map((name, nameIndex) => nameIndex === index ? value : name))}
          placeholder="Name on this device"
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="words"
          maxLength={80}
          style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, borderColor: c.input, backgroundColor: c.card, fontFamily: F.medium, fontSize: 15, color: c.foreground }}
        />
      </View>)}
      {hasInvalidNames ? <Muted>Each imported profile needs a unique name.</Muted> : null}
      <Btn icon="check" label="Add all profiles" loading={busy} disabled={hasInvalidNames} testID="button-confirm-import-all-people" onPress={() => void importPeople()} />
      <Btn variant="ghost" label="Cancel" disabled={busy} testID="button-cancel-import-all-people" onPress={() => { setPending(null); setError(null); }} />
    </View> : null}
    {busy && !pending ? <Muted>Preparing all-people file…</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID="status-all-people-transfer" style={{ fontFamily: F.semi, color: c.primary }}>{notice}</Text> : null}
  </Card>;
}
