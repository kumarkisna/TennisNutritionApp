import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useListFoods, type Food } from '@/lib/local-api';
import { useColors } from '@/hooks/useColors';
import { Btn, CaloriesMacros, Card, Chips, DISCLAIMER, EmptyState, ErrorBox, Eyebrow, F, LoadingBlock, Muted, Screen, Title } from '@/components/ui';
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

  const q = search.trim();
  const foods = useListFoods(q ? { search: q } : undefined);

  const shown = (foods.data ?? []).filter(f => filter === 'all' || f.source === filter);
  const sourceLabel = (f: Food) => f.source === 'custom' ? 'Custom' : f.source === 'open_food_facts' ? 'Saved' : cap(f.category);

  return <Screen tabs onRefresh={() => foods.refetch()} refreshing={foods.isRefetching}>
    <Eyebrow>03 / Food library</Eyebrow>
    <Title sub="Search the food library stored on this device or create a custom food. Values per 100 g.">Know what goes in.</Title>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.card, borderColor: c.input, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 }}>
          <Feather name="search" size={16} color={c.mutedForeground} />
          <TextInput testID="input-food-search" value={search} onChangeText={setSearch} placeholder="Search this device's food library" placeholderTextColor={c.mutedForeground} autoCapitalize="none" style={{ flex: 1, minHeight: 46, fontFamily: F.medium, fontSize: 15, color: c.foreground }} />
        </View>
        <Btn icon="plus" label="New" testID="button-new-food" onPress={() => router.push('/food-form')} />
      </View>
      <Chips testPrefix="filter-foods" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'custom', label: 'Custom' }, { value: 'open_food_facts', label: 'Saved' }, { value: 'reference', label: 'Reference' }]} />
      {foods.isLoading ? <LoadingBlock rows={5} height={68} /> : foods.isError ? <ErrorBox error={foods.error} onRetry={() => foods.refetch()} /> : shown.length === 0 ? <EmptyState icon="book-open" title={q ? 'No foods match that search' : 'No foods here yet'} description="Create a custom food to add it to your local library." actionLabel="Add custom food" onAction={() => router.push('/food-form')} /> :
        shown.map(f => <Card key={f.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}><Text testID={`text-food-${f.id}`} style={{ fontFamily: F.bold, fontSize: 15, color: c.foreground }}>{f.name}</Text><Muted>{sourceLabel(f)}{f.brand ? ` · ${f.brand}` : ''}</Muted></View>
            <CaloriesMacros calories={f.caloriesPer100g} protein={f.proteinPer100g} carbs={f.carbsPer100g} testPrefix={`food-${f.id}`} />
          </View>
          <Muted>Fat {n(f.fatPer100g, 1)} g · Fiber {f.fiberKnown ? `${n(f.fiberPer100g, 1)} g` : 'not reported'}</Muted>
          <Muted>{minerals(f)}</Muted>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {f.source === 'custom' ? <Btn small variant="ghost" icon="edit-2" label="Edit" testID={`button-edit-food-${f.id}`} onPress={() => router.push({ pathname: '/food-form', params: { id: String(f.id) } })} /> : null}
          </View>
        </Card>)}
    <Muted>{DISCLAIMER}</Muted>
  </Screen>;
}
