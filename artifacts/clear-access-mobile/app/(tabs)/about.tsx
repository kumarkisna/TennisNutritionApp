import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { APP_NAME, COPYRIGHT_NOTICE } from '@/constants/branding';
import { Btn, Card, Eyebrow, F, Muted, Screen, SectionTitle, Title, tap } from '@/components/ui';

type IconName = keyof typeof Feather.glyphMap;
type GuideStep = { title: string; body: string };
type Guide = {
  id: string;
  title: string;
  summary: string;
  icon: IconName;
  route: Href;
  action: string;
  steps: GuideStep[];
};

const guides: Guide[] = [
  {
    id: 'start',
    title: 'Start with a person and date',
    summary: 'Choose who the plan is for and manage personal profiles.',
    icon: 'users',
    route: '/people',
    action: 'Manage people',
    steps: [
      { title: 'Select a person', body: 'On Overview, use Manage people to add, edit, or select a person. Each person has separate plans, history, and progress records.' },
      { title: 'Choose the day', body: 'Open Planner and select the date you want to plan or review. Nutrition summaries and activity details use that person and date.' },
      { title: 'Know where data lives', body: 'Mobile records are stored on this device. Use Settings → Backup and restore to export a file before changing devices or reinstalling.' },
    ],
  },
  {
    id: 'planner',
    title: 'Plan meals, activity, sleep, and water',
    summary: 'Build a day, adjust its timing, then print the complete plan.',
    icon: 'calendar',
    route: '/planner',
    action: 'Open Planner',
    steps: [
      { title: 'Set the activity first', body: 'Choose the day’s activity in the tennis plan. Add the event time and duration; these details help organize the day but do not prescribe extra nutrition.' },
      { title: 'Add meal portions', body: 'Use the meal and food-slot controls to add portions and adjust their times. Tennis-timed portions keep their own slot time.' },
      { title: 'Schedule hydration', body: 'Add water to a food slot with its Add hydration control, or add separate hydration times for the rest of the day. Planned and recorded amounts can be tracked separately.' },
      { title: 'Record sleep and reorder', body: 'Save that date’s sleep times, naps, quality, and notes. Use the up/down controls on Planner to reorder major sections; display detail preferences are in Settings.' },
      { title: 'Print the day', body: 'Use Print day plan to include planned meals, tennis details, sleep, and hydration together.' },
    ],
  },
  {
    id: 'foods',
    title: 'Find or create foods',
    summary: 'Search the local library, scan a barcode, or enter nutrition yourself.',
    icon: 'book-open',
    route: '/foods',
    action: 'Open Foods',
    steps: [
      { title: 'Search your library', body: 'Foods shows the entries saved on this device. Search or filter the list, then open a custom entry to edit it.' },
      { title: 'Try a barcode scan', body: 'When adding food, scan a packaged-food barcode to look up available product data. Barcode records may not contain nutrition; if no usable values are found, enter the label details manually.' },
      { title: 'Enter a custom food', body: 'You can enter nutrients directly per 100 g. Optionally add ingredients with their weights and per-100 g values; the app calculates the combined food’s per-100 g nutrition from the ingredient proportions.' },
      { title: 'Check what is known', body: 'Some products do not report every nutrient. Unknown mineral values remain unknown rather than being treated as zero.' },
    ],
  },
  {
    id: 'history',
    title: 'Review and reuse past days',
    summary: 'Find rated meal combinations, notes, sleep, and hydration trends.',
    icon: 'clock',
    route: '/meal-history',
    action: 'Open History',
    steps: [
      { title: 'Choose a date', body: 'History’s calendar shows saved meal ratings by date. Select a day to review its meals, tennis plan, and timing details.' },
      { title: 'Save a useful combination', body: 'Rate the day’s meal combination from 1 to 10, add a keyword and optional note, then search saved reviews by keyword or note.' },
      { title: 'Reuse without losing context', body: 'Copy meal portions or a complete tennis plan to another date. Ratings and notes stay attached to the original person and date.' },
      { title: 'Compare trends', body: 'Use the sleep and hydration history views to review saved records and compare available date ranges. These summaries describe logged data, not medical assessments.' },
    ],
  },
  {
    id: 'settings',
    title: 'Personalize, get reminders, and back up',
    summary: 'Choose appearance, alerts, display preferences, and local backups.',
    icon: 'sliders',
    route: '/settings',
    action: 'Open Settings',
    steps: [
      { title: 'Choose appearance and display', body: 'Settings lets you select a color theme and adjust Planner display details. Move sections directly in Planner with its up/down controls.' },
      { title: 'Set optional alerts', body: 'Meal and hydration reminders are optional. Device settings and operating-system limits can affect whether notifications arrive.' },
      { title: 'Export or restore locally', body: 'The full backup is a single file for people and their mobile planner data; it is not cloud sync. Review the import preview carefully: restoring replaces local records after a recovery copy is made.' },
      { title: 'Use estimates carefully', body: 'Nutrition and hydration references support planning; they are not individual medical advice or fixed prescriptions. Ask a qualified professional about health concerns.' },
    ],
  },
];

export default function About() {
  const c = useColors();
  const router = useRouter();
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const selectedGuide = guides.find(guide => guide.id === selectedGuideId);

  return <Screen key={selectedGuideId ?? 'guide-index'} tabs>
    {selectedGuide ? <>
      <Btn small variant="ghost" icon="arrow-left" label="All guide topics" testID="button-about-guide-index"
        onPress={() => setSelectedGuideId(null)} />
      <Eyebrow>About / How to use</Eyebrow>
      <Title sub={selectedGuide.summary}>{selectedGuide.title}</Title>
      {selectedGuide.steps.map((step, index) => <Card key={step.title}>
        <Eyebrow>Step {String(index + 1).padStart(2, '0')}</Eyebrow>
        <Text style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 22, color: c.foreground }}>{step.title}</Text>
        <Muted>{step.body}</Muted>
      </Card>)}
      <Btn label={selectedGuide.action} icon="arrow-right" testID={`button-about-open-${selectedGuide.id}`}
        onPress={() => router.push(selectedGuide.route)} />
      <Muted>App help is included in this build. When app features change, their guide chapter and jump link should be updated with them.</Muted>
    </> : <>
      <Eyebrow>06 / About</Eyebrow>
      <Title sub="App information and a navigable guide to the main tasks.">{APP_NAME}</Title>
      <Card tone="ink">
        <View testID="about-copyright">
        <Eyebrow light>App owner</Eyebrow>
        <Text style={{ fontFamily: F.bold, fontSize: 16, lineHeight: 23, color: c.inkForeground }}>{COPYRIGHT_NOTICE}</Text>
        </View>
      </Card>

      <View style={{ gap: 4 }}>
        <SectionTitle>How to use the app</SectionTitle>
        <Muted>Choose a topic to open its step-by-step guide, then jump directly to that area of the app.</Muted>
      </View>

      {guides.map((guide, index) => <Card key={guide.id} style={{ padding: 0, overflow: 'hidden' }}>
        <Pressable testID={`button-about-guide-${guide.id}`} accessibilityRole="button"
          accessibilityLabel={`${guide.title}. ${guide.summary}`}
          onPress={() => { tap(); setSelectedGuideId(guide.id); }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, opacity: pressed ? 0.75 : 1 })}>
          <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }}>
            <Feather name={guide.icon} size={19} color={c.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Eyebrow>Guide {String(index + 1).padStart(2, '0')}</Eyebrow>
            <Text style={{ fontFamily: F.bold, fontSize: 14, lineHeight: 19, color: c.foreground }}>{guide.title}</Text>
            <Muted>{guide.summary}</Muted>
          </View>
          <Feather name="chevron-right" size={18} color={c.mutedForeground} />
        </Pressable>
      </Card>)}

      <Card>
        <Eyebrow>Device storage</Eyebrow>
        <Muted>Your mobile planner data stays on this device unless you choose to export a backup file.</Muted>
      </Card>
    </>}
  </Screen>;
}
