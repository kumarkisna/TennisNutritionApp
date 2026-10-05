import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import {
  exportLocalFoodLibrary,
  importLocalFoodLibrary,
  previewLocalFoodImport,
  type FoodLibraryImportPreview,
} from '@/lib/local-api';
import { pickFoodLibraryFile, saveFoodLibraryFile } from '@/lib/backup-file';
import { Btn, Card, ErrorBox, Eyebrow, F, Muted } from './ui';

type PendingFile = { name: string; serialized: string; preview: FoodLibraryImportPreview };

function countLabel(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function FoodLibraryTransfer() {
  const c = useColors();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const failed = (problem: unknown) => setError(problem instanceof Error ? problem : new Error(String(problem)));
  const isFoodQuery = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'listFoods';

  async function exportFoods() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveFoodLibraryFile(await exportLocalFoodLibrary());
      setNotice(result === 'saved'
        ? Platform.OS === 'android' ? 'Food file saved to the selected folder.' : 'Food file download started.'
        : result === 'shared' ? 'Share sheet closed.' : 'Export cancelled. No file was saved.');
    } catch (problem) {
      failed(problem);
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
      const file = await pickFoodLibraryFile();
      if (!file) return;
      const preview = await previewLocalFoodImport(file.serialized);
      setPending({ ...file, preview });
    } catch (problem) {
      failed(problem);
    } finally {
      setBusy(false);
    }
  }

  async function importFoods() {
    if (!pending || busy || pending.preview.newCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      await client.cancelQueries({ predicate: isFoodQuery });
      const result = await importLocalFoodLibrary(pending.serialized);
      setPending(null);
      try {
        await client.invalidateQueries({ predicate: isFoodQuery });
        setNotice(result.imported === 0
          ? `No new foods added; ${result.skippedDuplicates} exact ${result.skippedDuplicates === 1 ? 'match was' : 'matches were'} already in this library.`
          : `${countLabel(result.imported, 'food added', 'foods added')}; ${result.skippedDuplicates} exact ${result.skippedDuplicates === 1 ? 'match' : 'matches'} skipped.`);
      } catch {
        setError(new Error('Foods were imported, but the list could not refresh. Reopen the Foods tab to view them.'));
      }
    } catch (problem) {
      failed(problem);
    } finally {
      setBusy(false);
    }
  }

  const preview = pending?.preview;
  return <Card style={{ gap: 10 }}>
    <Eyebrow>Food library transfer</Eyebrow>
    <Muted>Export the foods saved on this device or import a food file. On Android, choose Save to device or Share with another app. Imports add new foods and skip exact matches; they do not change meal plans or profiles.</Muted>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Btn small icon="download" label="Export foods" disabled={busy || !!pending} testID="button-export-foods" onPress={() => void exportFoods()} />
      <Btn small icon="upload" label="Import foods" variant="ghost" disabled={busy} testID="button-import-foods" onPress={() => void chooseFile()} />
    </View>
    {preview ? <View testID="food-import-preview" style={{ gap: 8 }}>
      <Eyebrow>Review food import</Eyebrow>
      <Muted>File: {pending.name}</Muted>
      <Text style={{ fontFamily: F.semi, color: c.foreground }}>
        {countLabel(preview.incomingCount, 'food found', 'foods found')} · {preview.newCount} to add · {preview.duplicateCount} exact {preview.duplicateCount === 1 ? 'match' : 'matches'} to skip
      </Text>
      <Muted>Existing foods stay unchanged. No meals, profile data, or other planner records are included.</Muted>
      {preview.newCount > 0
        ? <Btn icon="check" label={`Add ${preview.newCount} ${preview.newCount === 1 ? 'food' : 'foods'}`} loading={busy} testID="button-confirm-import-foods" onPress={() => void importFoods()} />
        : <Text style={{ fontFamily: F.regular, fontSize: 13.5, color: c.mutedForeground }}>There are no new foods to add.</Text>}
      <Btn variant="ghost" label="Cancel" disabled={busy} testID="button-cancel-import-foods" onPress={() => { setPending(null); setError(null); }} />
    </View> : null}
    {busy && !pending ? <Muted>Preparing food file…</Muted> : null}
    {error ? <ErrorBox error={error} /> : null}
    {notice ? <Text testID="status-food-transfer" style={{ fontFamily: F.semi, color: c.primary }}>{notice}</Text> : null}
  </Card>;
}