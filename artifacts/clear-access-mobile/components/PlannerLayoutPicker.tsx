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
    <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>Day totals</Text>
    <Chips value={settings.dayTotalsPosition} disabled={disabled} testPrefix="select-day-totals-position"
      onChange={value => save({ dayTotalsPosition: value })}
      options={[{ value: 'first', label: 'First' }, { value: 'last', label: 'Last' }]} />
    <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>Planned portions</Text>
    <Chips value={settings.plannedPortionsPosition} disabled={disabled} testPrefix="select-planned-portions-position"
      onChange={value => save({ plannedPortionsPosition: value })}
      options={[{ value: 'first', label: 'First' }, { value: 'last', label: 'Last' }]} />
    <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>Sleep log in Planner</Text>
    <Chips value={settings.sleepLogPosition} disabled={disabled} testPrefix="select-sleep-log-position"
      onChange={value => save({ sleepLogPosition: value })}
      options={[{ value: 'first', label: 'First' }, { value: 'last', label: 'Last' }]} />
    <Text style={{ fontFamily: F.semi, fontSize: 13, color: c.foreground }}>Hydration plan in Planner</Text>
    <Muted>Middle places it after Planning targets and before the sections positioned last.</Muted>
    <Chips value={settings.hydrationPosition} disabled={disabled} testPrefix="select-hydration-position"
      onChange={value => save({ hydrationPosition: value })}
      options={[{ value: 'first', label: 'First' }, { value: 'middle', label: 'Middle' }, { value: 'last', label: 'Last' }]} />
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
