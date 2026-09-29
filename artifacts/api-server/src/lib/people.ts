import {
  db,
  mealEntriesTable,
  peopleTable,
  preferencesTable,
  type Person as PersonRow,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { toPreferences } from "./planner-data";

export function toPerson(person: PersonRow) {
  return {
    id: person.id,
    name: person.name,
    isDefault: person.defaultKey !== null,
    weightKg: person.weightKg,
    ageYears: person.ageYears,
    ...toPreferences(person),
  };
}

export async function ensureDefaultPerson(ownerId: string): Promise<PersonRow> {
  let [person] = await db
    .select()
    .from(peopleTable)
    .where(eq(peopleTable.defaultKey, ownerId))
    .limit(1);
  if (!person) {
    const [legacy] = await db
      .select()
      .from(preferencesTable)
      .where(eq(preferencesTable.userId, ownerId))
      .limit(1);
    const [created] = await db
      .insert(peopleTable)
      .values({
        ownerId,
        defaultKey: ownerId,
        name: "Me",
        activityLevel: legacy?.activityLevel ?? "sedentary",
        baselineCalories: legacy?.baselineCalories ?? 2000,
      })
      .onConflictDoNothing({ target: peopleTable.defaultKey })
      .returning();
    [person] = created
      ? [created]
      : await db
        .select()
        .from(peopleTable)
        .where(eq(peopleTable.defaultKey, ownerId))
        .limit(1);
  }
  if (!person) throw new Error("Default planner person could not be created.");

  // The nullable person_id keeps old plans intact until they are assigned here.
  await db
    .update(mealEntriesTable)
    .set({ personId: person.id })
    .where(
      and(
        eq(mealEntriesTable.ownerId, ownerId),
        isNull(mealEntriesTable.personId),
      ),
    );
  return person;
}

export async function getOwnedPerson(ownerId: string, personId: number): Promise<PersonRow | undefined> {
  const defaultPerson = await ensureDefaultPerson(ownerId);
  if (defaultPerson.id === personId) return defaultPerson;
  const [person] = await db
    .select()
    .from(peopleTable)
    .where(and(eq(peopleTable.id, personId), eq(peopleTable.ownerId, ownerId)))
    .limit(1);
  return person;
}