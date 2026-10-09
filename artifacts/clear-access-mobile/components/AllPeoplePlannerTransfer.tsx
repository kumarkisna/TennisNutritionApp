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
  const [targetPersonIds, setTargetPersonIds] = useState<Array<number | null>>([]);
  const [updatingPreview, setUpdatingPreview] = useState(false);
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
      setTargetPersonIds(preview.people.map(person => person.matchedPerson?.id ?? null));
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setBusy(false);
    }
  }

  async function updateRestoreTarget(index: number, targetPersonId: number | null) {
    const file = pending;
    if (!file || busy || updatingPreview) return;
    const nextTargetPersonIds = targetPersonIds.map((id, targetIndex) =>
      targetIndex === index ? targetPersonId : id);
    setUpdatingPreview(true);
    setError(null);
    try {
      const preview = await previewLocalAllPeoplePlannerImport(
        file.serialized,
        importNames,
        nextTargetPersonIds,
      );
      setTargetPersonIds(nextTargetPersonIds);
      setPending(current => current?.serialized === file.serialized
        ? { ...current, preview }
        : current);
    } catch (problem) {
      setError(problem instanceof Error ? problem : new Error(String(problem)));
    } finally {
      setUpdatingPreview(false);
    }
  }

  async function importPeople() {
    if (!pending || busy || updatingPreview) return;
    setBusy(true);
    setError(null);
    try {
      await client.cancelQueries({ predicate: isPlannerQuery });
      const result = await importLocalAllPeoplePlanner(pending.serialized, importNames, targetPersonIds);
      setPending(null);
      try {
        await client.invalidateQueries({ predicate: isPlannerQuery });
        const profileActions = [
          result.people.length ? `${countLabel(result.people.length, 'profile', 'profiles')} added` : '',
          result.matchedPeople.length ? `${countLabel(result.matchedPeople.length, 'profile', 'profiles')} restored into existing profiles` : '',
        ].filter(Boolean).join('; ');
        setNotice(
          `${profileActions} with ` +
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

  const nameKeys = importNames
    .filter((_, index) => targetPersonIds[index] == null)
    .map(name => name.trim().toLocaleLowerCase());
  const hasInvalidNames = nameKeys.some(name => !name) || new Set(nameKeys).size !== nameKeys.length;
  const selectedTargets = targetPersonIds.filter((id): id is number => id !== null);
  const hasRepeatedTargets = new Set(selectedTargets).size !== selectedTargets.length;
  const preview = pending?.preview;
  return <Card style={{ gap: 10 }}>
    <Eyebrow>Move everyone in one file</Eyebrow>
    <Muted>Exports all profiles on this device, their meals, activities, height and weight history, and foods used in those meals. Unused food-library items and device reminder settings are not included. Keep the file private.</Muted>
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      <Btn icon="download" label="Export all people" disabled={busy || updatingPreview} loading={busy} testID="button-export-all-people" onPress={() => void exportPeople()} />
      <Btn icon="upload" label="Import all-people file" variant="ghost" disabled={busy || updatingPreview} testID="button-import-all-people" onPress={() => void chooseFile()} />
    </View>
    {preview ? <View testID="all-people-import-preview" style={{ gap: 9 }}>
      <Eyebrow>Review before importing</Eyebrow>
      <Muted>File: {pending.name}</Muted>
      <View testID="all-people-restore-estimate" style={{ gap: 4, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12 }}>
        <Muted>Profiles: {preview.estimate.newProfiles} new · {preview.estimate.matchedProfiles} restoring to existing profiles</Muted>
        <Muted>Shared foods: {preview.estimate.foods.toAdd} new · {preview.estimate.foods.toSkip} matching foods to reuse</Muted>
        <Muted>Meals: {preview.estimate.entries.toAdd} to add · {preview.estimate.entries.toSkip} duplicates to skip</Muted>
        <Muted>Activity days: {preview.estimate.activities.toAdd} to add or update · {preview.estimate.activities.toSkip} unchanged</Muted>
        <Muted>Height records: {preview.estimate.heightRecords.toAdd} to add · {preview.estimate.heightRecords.toSkip} duplicates to skip</Muted>
        <Muted>Weigh-ins: {preview.estimate.weightRecords.toAdd} to add · {preview.estimate.weightRecords.toSkip} duplicates to skip</Muted>
      </View>
      <Muted>Matching backup IDs restore into the same people. For a first import, you can link a same-name profile or import separately. Existing profile settings and records are preserved; missing records are added.</Muted>
      {preview.people.map((person, index) => <View key={`${person.personName}-${index}`} style={{ gap: 5 }}>
        <Text style={{ fontFamily: F.semi, color: c.foreground }}>
          {person.personName}{person.nameConflict ? ' · name conflict' : ''}
        </Text>
        <View testID={`all-people-profile-estimate-${index}`} style={{ gap: 3, padding: 9, borderWidth: 1, borderColor: c.border, borderRadius: 10 }}>
          <Muted>{person.estimate.destination === 'existing'
            ? `Destination: existing profile, ${person.estimate.targetPerson?.name ?? 'selected person'}`
            : `Destination: new profile, ${importNames[index]?.trim() || person.suggestedName}`}</Muted>
          <Muted>Meals: {person.estimate.entries.toAdd} to add · {person.estimate.entries.toSkip} duplicates to skip</Muted>
          <Muted>Activity days: {person.estimate.activities.toAdd} to add or update · {person.estimate.activities.toSkip} unchanged</Muted>
          <Muted>Height records: {person.estimate.heightRecords.toAdd} to add · {person.estimate.heightRecords.toSkip} duplicates to skip</Muted>
          <Muted>Weigh-ins: {person.estimate.weightRecords.toAdd} to add · {person.estimate.weightRecords.toSkip} duplicates to skip</Muted>
        </View>
        {person.matchedPerson && targetPersonIds[index] === person.matchedPerson.id
          ? <Muted>Backup ID matched {person.matchedPerson.name}; missing records will be restored there.</Muted>
          : null}
        {!person.matchedPerson && person.sameNamePerson ? <View style={{ gap: 5 }}>
          <Muted>The name matches an existing profile, but the backup IDs differ. Link it if this is the same person.</Muted>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Btn
              small
              label={`Restore into ${person.sameNamePerson.name}`}
              variant={targetPersonIds[index] === person.sameNamePerson.id ? 'primary' : 'ghost'}
              disabled={busy || updatingPreview}
              testID={`button-link-all-people-${index}`}
              onPress={() => void updateRestoreTarget(index, person.sameNamePerson!.id)}
            />
            <Btn
              small
              label="Import separately"
              variant={targetPersonIds[index] == null ? 'primary' : 'ghost'}
              disabled={busy || updatingPreview}
              testID={`button-unlink-all-people-${index}`}
              onPress={() => void updateRestoreTarget(index, null)}
            />
          </View>
        </View> : null}
        {!person.hasStableIdentity && targetPersonIds[index] == null
          ? <Muted>This older file has no stable backup ID, so it cannot be matched automatically.</Muted>
          : null}
        {targetPersonIds[index] == null ? <TextInput
          testID={`input-all-people-import-name-${index}`}
          value={importNames[index] ?? ''}
          onChangeText={value => setImportNames(current => current.map((name, nameIndex) => nameIndex === index ? value : name))}
          editable={!busy && !updatingPreview}
          placeholder="Name on this device"
          placeholderTextColor={c.mutedForeground}
          autoCapitalize="words"
          maxLength={80}
          style={{ minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12, borderColor: c.input, backgroundColor: c.card, fontFamily: F.medium, fontSize: 15, color: c.foreground }}
        /> : null}
      </View>)}
      {hasInvalidNames ? <Muted>Each new profile needs a unique name.</Muted> : null}
      {hasRepeatedTargets ? <Muted>Each existing profile can be selected only once.</Muted> : null}
      {updatingPreview ? <Muted>Updating restore estimate…</Muted> : null}
      <Btn icon="check" label="Restore people" loading={busy} disabled={updatingPreview || hasInvalidNames || hasRepeatedTargets} testID="button-confirm-import-all-people" onPress={() => void importPeople()} />
      <Btn variant="ghost" label="Cancel" disabled={busy || updatingPreview} testID="button-cancel-import-all-people" onPress={() => { setPending(null); setError(null); }} />
    </View> : null}
    {busy && !pending ? <Muted>Preparing all-people file…</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID="status-all-people-transfer" style={{ fontFamily: F.semi, color: c.primary }}>{notice}</Text> : null}
  </Card>;
}
