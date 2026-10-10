import { Text } from 'react-native';
import { usePlannerLayout } from '@/contexts/PlannerLayoutProvider';
import { useColors } from '@/hooks/useColors';
import { Card, Chips, Eyebrow, F, Muted, warn, success } from './ui';
import { ErrorBox } from './ui';

export function PlannerLayoutPicker() {
  const c = useColors();
  const { mode, loading, saving, error, selectMode } = usePlannerLayout();
  return <Card>
    <Eyebrow>Planner display</Eyebrow>
    <Text style={{ fontFamily: F.bold, fontSize: 19, color: c.foreground }}>Choose how much guidance to show.</Text>
    <Muted>Option 2 moves meals higher and hides explanatory text. Planned data, controls, totals and safety warnings stay visible.</Muted>
    <Chips
      value={mode}
      disabled={loading || saving}
      testPrefix="select-planner-layout"
      onChange={value => void selectMode(value).then(saved => saved ? success() : warn())}
      options={[
        { value: 'current', label: '1 · Current layout' },
        { value: 'compact', label: '2 · Hide explanations' },
      ]}
    />
    <Text accessibilityLiveRegion="polite" style={{ fontFamily: F.medium, fontSize: 12, color: c.primary }}>
      {loading ? 'Loading Planner layout…' : saving ? 'Saving Planner layout…' : `Selected: ${mode === 'current' ? 'Current layout' : 'Hide explanations'}`}
    </Text>
    {error ? <ErrorBox error={new Error(error)} /> : null}
  </Card>;
}
