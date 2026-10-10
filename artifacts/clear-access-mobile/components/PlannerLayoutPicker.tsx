import { Text } from 'react-native';
import { usePlannerLayout } from '@/contexts/PlannerLayoutProvider';
import { useColors } from '@/hooks/useColors';
import { Card, Chips, Eyebrow, F, Muted, warn, success } from './ui';
import { ErrorBox } from './ui';

export function PlannerLayoutPicker() {
  const c = useColors();
  const { settings, loading, saving, error, updateSettings } = usePlannerLayout();
  const disabled = loading || saving;
  const save = (changes: Parameters<typeof updateSettings>[0]) =>
    void updateSettings(changes).then(saved => saved ? success() : warn());
  return <Card>
    <Eyebrow>Planner display</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Make the next action easy to reach.</Text>
    <Muted>These choices save on this device. The first layout option keeps explanatory text; compact hides guidance but keeps the data and safety notes.</Muted>
    <Chips
      value={settings.mode}
      disabled={disabled}
      testPrefix="select-planner-layout"
      onChange={value => save({ mode: value })}
      options={[
        { value: 'current', label: '1 · Current layout' },
        { value: 'compact', label: '2 · Action view' },
      ]}
    />
    <Muted>Use “Reorder sections” on the Planner to move Day totals, Planned portions, Tennis plan, Sleep, Hydration, and Planning guidance up or down. Date controls, printing, and safety notes stay fixed.</Muted>
    <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>Tennis plan relative to portions</Text>
    <Chips value={settings.tennisPlanPosition} disabled={disabled} testPrefix="select-tennis-plan-position"
      onChange={value => save({ tennisPlanPosition: value })}
      options={[{ value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
    <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.medium, fontSize: 12, color: c.primary }}>
      {loading ? 'Loading Planner settings…' : saving ? 'Saving Planner settings…' : `Selected: ${settings.mode === 'current' ? 'Current layout' : 'Action view'}`}
    </Text>
    {error ? <ErrorBox error={new Error(error)} /> : null}
  </Card>;
}
