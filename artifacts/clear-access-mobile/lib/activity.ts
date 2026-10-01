import type { ActivityLevelType } from '@/lib/local-api';
export const activityOptions: { value: ActivityLevelType; title: string; description: string; multiplier: number }[] = [
  { value: 'sedentary', title: 'Mostly seated', description: 'Desk-based days, little planned movement', multiplier: 1 },
  { value: 'light', title: 'Lightly active', description: 'Gentle activity a few days a week', multiplier: 1.1 },
  { value: 'moderate', title: 'Moderately active', description: 'Regular movement through the week', multiplier: 1.2 },
  { value: 'very_active', title: 'Very active', description: 'Frequent, demanding activity', multiplier: 1.35 },
];
