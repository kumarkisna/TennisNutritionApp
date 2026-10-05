import { useRouter } from 'expo-router';
import { PlanningTargets } from '@/components/PlanningTargets';
import { MealAlertSettings } from '@/components/MealAlertSettings';
import { LocalBackup } from '@/components/LocalBackup';
import { ThemePicker } from '@/components/ThemePicker';
import { usePlanner } from '@/contexts/PlannerProvider';
import { Btn, Card, Eyebrow, Muted, Screen, Title } from '@/components/ui';

export default function Settings() {
  const router = useRouter();
  const { person, date } = usePlanner();
  return <Screen tabs>
    <Eyebrow>04 / Settings</Eyebrow>
    <Title sub="Each person keeps their own details. Estimates are for planning only, never medical requirements.">{`${person.name}'s details.`}</Title>
    <ThemePicker />
    <MealAlertSettings />
    <LocalBackup />
    <Card>
      <Eyebrow>Saved planning targets</Eyebrow>
      <PlanningTargets person={person} date={date} testPrefix="settings-target" />
      <Muted>These use saved details. Edit this person to update them. Choose the day's planned activity in Planner.</Muted>
    </Card>
    <Btn variant="ghost" label="Edit person details" testID="button-settings-edit-person"
      onPress={() => router.push({ pathname: '/person-form', params: { id: String(person.id) } })} />
    <Btn variant="ghost" label="Height history & CDC reference" icon="trending-up" testID="button-settings-height-chart" onPress={() => router.push('/height')} />
    <Btn variant="ghost" label="Weight progress & target" icon="activity" testID="button-settings-weight-progress" onPress={() => router.push('/weight')} />
  </Screen>;
}
