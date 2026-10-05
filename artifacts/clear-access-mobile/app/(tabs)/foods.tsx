import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useDeleteFood, useListFoods, type Food } from '@/lib/local-api';
import { useColors } from '@/hooks/useColors';
import { Btn, CaloriesMacros, Card, Chips, DISCLAIMER, EmptyState, ErrorBox, Eyebrow, F, LoadingBlock, Muted, Screen, Title, success, warn } from '@/components/ui';
import { FoodLibraryTransfer } from '@/components/FoodLibraryTransfer';
import { cap, n } from '@/lib/format';

type Filter = 'all' | 'custom' | 'open_food_facts' | 'reference';

function minerals(f: { calciumMgPer100g: number | null; ironMgPer100g: number | null }) {
  return `Calcium ${f.calciumMgPer100g === null ? 'unknown' : `${n(f.calciumMgPer100g, 1)} mg`} · Iron ${f.ironMgPer100g === null ? 'unknown' : `${n(f.ironMgPer100g, 2)} mg`}`;
}

export default function Foods() {
  const c = useColors();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const remove = useDeleteFood();

  const q = search.trim();
  const foods = useListFoods(q ? { search: q } : undefined);

  const shown = (foods.data ?? []).filter(f => filter === 'all' || f.source === filter);
  const sourceLabel = (f: Food) => f.source === 'custom' ? 'Custom' : f.source === 'open_food_facts' ? 'Saved' : cap(f.category);

  async function deleteFood(id: number) {
    try {
      await remove.mutateAsync({ id });
      setConfirmingDeleteId(null);
      success();
    } catch {
      warn();
    }
  }

  function cancelDelete() {
    if (remove.isPending) return;
    setConfirmingDeleteId(null);
    remove.reset();
  }

  return <Screen tabs onRefresh={() => foods.refetch()} refreshing={foods.isRefetching}>
    <Eyebrow>03 / Food library</Eyebrow>
    <Title sub="Search the food library stored on this device or create a custom food. Values per 100 g.">Know what goes in.</Title>
    <FoodLibraryTransfer />

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.input, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
          <Feather name="search" size={16} color={c.mutedForeground} />
          <TextInput testID="input-food-search" value={search} editable={!remove.isPending} onChangeText={value => { setSearch(value); setConfirmingDeleteId(null); remove.reset(); }} placeholder="Search this device's food library" placeholderTextColor={c.mutedForeground} autoCapitalize="none" style={{ flex: 1, minHeight: 46, fontFamily: F.medium, fontSize: 15, color: c.foreground }} />
        </View>
        <Btn icon="plus" label="New" disabled={remove.isPending} testID="button-new-food" onPress={() => router.push('/food-form')} />
      </View>
      <Chips testPrefix="filter-foods" value={filter} onChange={value => { setFilter(value); setConfirmingDeleteId(null); remove.reset(); }} disabled={remove.isPending} options={[{ value: 'all', label: 'All' }, { value: 'custom', label: 'Custom' }, { value: 'open_food_facts', label: 'Saved' }, { value: 'reference', label: 'Reference' }]} />
      {foods.isLoading ? <LoadingBlock rows={5} height={68} /> : foods.isError ? <ErrorBox error={foods.error} onRetry={() => foods.refetch()} /> : shown.length === 0 ? <EmptyState icon="book-open" title={q ? 'No foods match that search' : 'No foods here yet'} description="Create a custom food to add it to your local library." actionLabel="Add custom food" onAction={() => router.push('/food-form')} /> :
        shown.map(f => <Card key={f.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Text testID={`text-food-${f.id}`} style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{f.name}</Text><Muted>{sourceLabel(f)}{f.brand ? ` · ${f.brand}` : ''}</Muted></View>
            <CaloriesMacros calories={f.caloriesPer100g} protein={f.proteinPer100g} carbs={f.carbsPer100g} fat={f.fatPer100g} testPrefix={`food-${f.id}`} />
          </View>
          <Muted>Fiber {f.fiberKnown ? `${n(f.fiberPer100g, 1)} g` : 'not reported'}</Muted>
          <Muted>{minerals(f)}</Muted>
          {f.source !== 'reference' ? <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {f.source === 'custom' ? <Btn small variant="ghost" icon="edit-2" label="Edit" testID={`button-edit-food-${f.id}`} onPress={() => router.push({ pathname: '/food-form', params: { id: String(f.id) } })} /> : null}
              <Btn small variant="danger" icon="trash-2" label="Delete" disabled={remove.isPending} testID={`button-delete-food-${f.id}`} onPress={() => { remove.reset(); setConfirmingDeleteId(f.id); }} />
            </View>
            {confirmingDeleteId === f.id ? <View testID={`panel-confirm-delete-food-${f.id}`} accessibilityRole="alert" style={{ gap: 8, marginTop: 8, padding: 12, borderWidth: 1, borderColor: c.destructiveBorder, borderRadius: 14, backgroundColor: c.destructiveSoft }}>
              <Text style={{ fontFamily: F.bold, fontSize: 14, lineHeight: 20, color: c.destructive }}>Delete {f.name} from your food library?</Text>
              <Muted style={{ color: c.destructive }}>This cannot be undone. Foods used by planned meals cannot be deleted; remove those meal entries first.</Muted>
              {remove.isError ? <ErrorBox error={remove.error} /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Btn small variant="danger" icon="trash-2" label="Yes, delete food" loading={remove.isPending} testID={`button-confirm-delete-food-${f.id}`} onPress={() => void deleteFood(f.id)} />
                <Btn small variant="ghost" label="Keep food" disabled={remove.isPending} testID={`button-cancel-delete-food-${f.id}`} onPress={cancelDelete} />
              </View>
            </View> : null}
          </> : null}
        </Card>)}
    <Muted>{DISCLAIMER}</Muted>
  </Screen>;
}
