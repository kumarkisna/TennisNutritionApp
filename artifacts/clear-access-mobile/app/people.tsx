import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  useDeletePerson,
  useReassignPersonBackupIdentity,
  useUnlinkPersonBackupIdentity,
  type Person,
} from '@/lib/local-api';
import { usePlanner } from '@/contexts/PlannerProvider';
import { useColors } from '@/hooks/useColors';
import { Btn, Card, ErrorBox, Eyebrow, F, Muted, Screen, Title, success, warn, tap } from '@/components/ui';
import { PersonPlannerExportButton, PersonPlannerImport } from '@/components/PersonPlannerTransfer';
import { AllPeoplePlannerTransfer } from '@/components/AllPeoplePlannerTransfer';
import { n, today } from '@/lib/format';
import { getAgeOnDate } from '@/lib/planning-targets';

type BackupIdentityAction = {
  kind: 'unlink' | 'reassign';
  personId: number;
  backupId: string;
  targetPersonId?: number;
};

function People() {
  const c = useColors();
  const router = useRouter();
  const { people, person, selectPerson, refreshPeople } = usePlanner();
  const remove = useDeletePerson();
  const unlinkBackupIdentity = useUnlinkPersonBackupIdentity();
  const reassignBackupIdentity = useReassignPersonBackupIdentity();
  const [confirming, setConfirming] = useState<Person | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [expandedBackupPersonId, setExpandedBackupPersonId] = useState<number | null>(null);
  const [backupIdentityAction, setBackupIdentityAction] = useState<BackupIdentityAction | null>(null);
  const [backupIdentityError, setBackupIdentityError] = useState<Error | null>(null);
  const [backupIdentityBusy, setBackupIdentityBusy] = useState(false);

  async function del() {
    if (!confirming || confirming.isDefault || !confirmed) return;
    try {
      await remove.mutateAsync({ id: confirming.id });
      if (person.id === confirming.id) selectPerson(people.find(p => p.isDefault)!.id);
      refreshPeople(); setConfirming(null); setConfirmed(false); success();
    } catch { warn(); }
  }

  async function confirmBackupIdentityAction() {
    if (!backupIdentityAction || backupIdentityBusy) return;
    setBackupIdentityBusy(true);
    setBackupIdentityError(null);
    try {
      if (backupIdentityAction.kind === 'unlink') {
        await unlinkBackupIdentity.mutateAsync({
          personId: backupIdentityAction.personId,
          backupId: backupIdentityAction.backupId,
        });
      } else if (backupIdentityAction.targetPersonId !== undefined) {
        await reassignBackupIdentity.mutateAsync({
          sourcePersonId: backupIdentityAction.personId,
          backupId: backupIdentityAction.backupId,
          targetPersonId: backupIdentityAction.targetPersonId,
        });
      } else {
        return;
      }
      setBackupIdentityAction(null);
      refreshPeople();
      success();
    } catch (problem) {
      const error = problem instanceof Error ? problem : new Error(String(problem));
      setBackupIdentityError(error);
      warn();
    } finally {
      setBackupIdentityBusy(false);
    }
  }

  return <Screen title="People">
    <Eyebrow>This device / separate plans</Eyebrow>
    <Title sub="Everyone has their own meals and body details for daily planning estimates. Your food library stays shared on this device.">People in your planner.</Title>
    <AllPeoplePlannerTransfer />
    <PersonPlannerImport />
    {people.map(p => {
      const on = p.id === person.id;
      const age = p.dateOfBirth ? getAgeOnDate(p.dateOfBirth, today()) : null;
      const linkedBackupIds = p.backupIds.slice(1);
      const backupIdentityActionForPerson = backupIdentityAction?.personId === p.id
        ? backupIdentityAction
        : null;
      const backupIdentityTarget = backupIdentityActionForPerson?.kind === 'reassign' &&
        backupIdentityActionForPerson.targetPersonId !== undefined
        ? people.find(candidate => candidate.id === backupIdentityActionForPerson.targetPersonId)
        : undefined;
      const otherPeople = people.filter(candidate => candidate.id !== p.id);
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
        <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 }}>
          <Btn
            small
            variant="ghost"
            icon="link"
            label={`Manage backup links (${linkedBackupIds.length})`}
            testID={`button-manage-backup-links-${p.id}`}
            onPress={() => {
              tap();
              setExpandedBackupPersonId(current => current === p.id ? null : p.id);
              setBackupIdentityAction(null);
              setBackupIdentityError(null);
            }}
          />
          {expandedBackupPersonId === p.id ? <View testID={`panel-backup-links-${p.id}`} style={{ gap: 9 }}>
            <Muted>The profile’s original backup identity stays in place. These linked IDs decide which profile receives future restores.</Muted>
            {linkedBackupIds.length === 0
              ? <Muted>No imported backup identities are linked to this profile.</Muted>
              : linkedBackupIds.map(backupId => <View
                key={backupId}
                testID={`row-backup-link-${p.id}-${backupId}`}
                style={{ gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.border }}
              >
                <Text
                  selectable
                  accessibilityLabel={`Imported backup identity for ${p.name}`}
                  testID={`text-backup-link-${p.id}-${backupId}`}
                  style={{ fontFamily: F.medium, fontSize: 12, lineHeight: 18, color: c.secondary }}
                >
                  {backupId}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Btn
                    small
                    variant="ghost"
                    icon="repeat"
                    label="Move"
                    disabled={backupIdentityBusy}
                    testID={`button-move-backup-link-${p.id}-${backupId}`}
                    onPress={() => {
                      setBackupIdentityAction({ kind: 'reassign', personId: p.id, backupId });
                      setBackupIdentityError(null);
                    }}
                  />
                  <Btn
                    small
                    variant="danger"
                    icon="x-circle"
                    label="Unlink"
                    disabled={backupIdentityBusy}
                    testID={`button-unlink-backup-link-${p.id}-${backupId}`}
                    onPress={() => {
                      setBackupIdentityAction({ kind: 'unlink', personId: p.id, backupId });
                      setBackupIdentityError(null);
                    }}
                  />
                </View>
              </View>)}
            {backupIdentityActionForPerson ? <View
              testID={`panel-backup-link-action-${p.id}`}
              style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 12 }}
            >
              {backupIdentityActionForPerson.kind === 'unlink' ? <>
                <Eyebrow>Confirm unlink</Eyebrow>
                <Muted>Future restores with this ID will no longer match {p.name} automatically. Existing profiles, settings, meals, and records will not change.</Muted>
                <Btn
                  small
                  variant="danger"
                  icon="x-circle"
                  label="Unlink this identity"
                  loading={backupIdentityBusy}
                  disabled={backupIdentityBusy}
                  testID="button-confirm-unlink-backup-identity"
                  onPress={() => void confirmBackupIdentityAction()}
                />
              </> : backupIdentityActionForPerson.targetPersonId === undefined ? <>
                <Eyebrow>Choose a destination profile</Eyebrow>
                <Muted>Only future restores using this identity will go to the selected profile. No planner data or profile settings will move.</Muted>
                {otherPeople.length === 0
                  ? <Muted>Add another profile before moving this identity.</Muted>
                  : otherPeople.map(target => <Btn
                    key={target.id}
                    small
                    variant="ghost"
                    icon="corner-up-right"
                    label={`Choose ${target.name}`}
                    disabled={backupIdentityBusy}
                    testID={`button-choose-backup-target-${target.id}`}
                    onPress={() => setBackupIdentityAction(current => current
                      ? { ...current, targetPersonId: target.id }
                      : current)}
                  />)}
              </> : <>
                <Eyebrow>Confirm identity move</Eyebrow>
                <Muted>{backupIdentityTarget
                  ? `Move this identity from ${p.name} to ${backupIdentityTarget.name}? Only future backup matching changes; neither profile settings nor planner records move.`
                  : 'The selected profile is no longer available. Cancel and choose another profile.'}</Muted>
                {backupIdentityTarget ? <Btn
                  small
                  icon="repeat"
                  label={`Move to ${backupIdentityTarget.name}`}
                  loading={backupIdentityBusy}
                  disabled={backupIdentityBusy}
                  testID="button-confirm-move-backup-identity"
                  onPress={() => void confirmBackupIdentityAction()}
                /> : null}
              </>}
              {backupIdentityError ? <ErrorBox error={backupIdentityError} /> : null}
              <Btn
                small
                variant="ghost"
                label="Cancel"
                disabled={backupIdentityBusy}
                testID="button-cancel-backup-identity-action"
                onPress={() => {
                  setBackupIdentityAction(null);
                  setBackupIdentityError(null);
                }}
              />
            </View> : null}
          </View> : null}
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
