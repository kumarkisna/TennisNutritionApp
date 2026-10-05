import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useDeletePerson, type Person } from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, ErrorBox, Eyebrow, F, Muted, Screen, Title, success, warn, tap } from '@/components/ui';
import { PersonPlannerExportButton, PersonPlannerImport } from '@/components/PersonPlannerTransfer';
import { n, today } from '@/lib/format';
import { getAgeOnDate } from '@/lib/planning-targets';

function People() {
  const c = useColors();
  const router = useRouter();
  const { people, person, selectPerson, refreshPeople } = usePlanner();
  const remove = useDeletePerson();
  const [confirming, setConfirming] = useState<Person | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function del() {
    if (!confirming || confirming.isDefault || !confirmed) return;
    try {
      await remove.mutateAsync({ id: confirming.id });
      if (person.id === confirming.id) selectPerson(people.find(p => p.isDefault)!.id);
      refreshPeople(); setConfirming(null); setConfirmed(false); success();
    } catch { warn(); }
  }

  return <Screen title="People">
    <Eyebrow>This device / separate plans</Eyebrow>
    <Title sub="Everyone has their own meals and body details for daily planning estimates. Your food library stays shared on this device.">People in your planner.</Title>
    <PersonPlannerImport />
    {people.map(p => {
      const on = p.id === person.id;
      const age = p.dateOfBirth ? getAgeOnDate(p.dateOfBirth, today()) : null;
      return <Card key={p.id} tone={on ? 'mint' : 'card'} style={{ gap: 8 }}>
        <Pressable testID={`row-person-${p.id}`} onPress={() => { tap(); selectPerson(p.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Feather name={on ? 'check-circle' : 'circle'} size={22} color={on ? c.primary : c.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: c.foreground }}>{p.name}</Text>
             <Muted>{p.isDefault ? 'Default · ' : ''}{p.weightKg === null ? 'Weight not set' : `${n(p.weightKg, 1)} kg`}{age === null ? ' · Age not set' : ` · ${age} years`}{on ? ' · Selected' : ''}</Muted>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn small variant="ghost" icon="edit-2" label="Edit" testID={`button-edit-person-${p.id}`} onPress={() => router.push({ pathname: '/person-form', params: { id: String(p.id) } })} />
          <PersonPlannerExportButton person={p} />
          {!p.isDefault ? <Btn small variant="danger" icon="trash-2" label="Delete" testID={`button-delete-person-${p.id}`} onPress={() => { setConfirming(p); setConfirmed(false); remove.reset(); }} /> : null}
        </View>
      </Card>;
    })}
    <Btn icon="plus" label="Add person" testID="button-add-person" onPress={() => router.push('/person-form')} />
    {confirming ? <Card tone="danger" style={{ gap: 12 }}>
      <View testID="panel-confirm-delete-person" accessibilityRole="alert" style={{ gap: 10 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 17, color: c.destructive }}>Delete {confirming.name} and ALL their planned meals?</Text>
        <Text style={{ fontFamily: F.regular, fontSize: 13.5, lineHeight: 20, color: c.destructive }}>This permanently deletes this person and every meal entry in their plan, across all dates. It cannot be undone. Your shared foods and other people's plans remain.</Text>
        <Pressable testID="checkbox-confirm-delete-person" accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => { tap(); setConfirmed(v => !v); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Feather name={confirmed ? 'check-square' : 'square'} size={22} color={c.destructive} />
          <Text style={{ flex: 1, fontFamily: F.semi, fontSize: 13.5, color: c.destructive }}>I understand all of {confirming.name}'s planned meals will be deleted.</Text>
        </Pressable>
        {remove.isError ? <ErrorBox error={remove.error} /> : null}
        <Btn variant="danger" icon="trash-2" label="Delete person and meals" disabled={!confirmed} loading={remove.isPending} testID="button-confirm-delete-person" onPress={() => void del()} />
        <Btn variant="ghost" label="Keep person" testID="button-cancel-delete-person" onPress={() => { setConfirming(null); setConfirmed(false); }} />
      </View>
    </Card> : null}
  </Screen>;
}
export default function PeopleRoute() { return <People />; }
