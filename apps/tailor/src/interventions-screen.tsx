import { useCallback, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import type { Intervention, TailorApi } from './api';
import { describeError, fabricLabel, formatDay, formatTime, garmentLabel, STATUSES } from './schedule';
import { Badge, Button, Card, ErrorText, type Palette, useStyles } from './theme';
import { usePolled } from './use-polled';

/** "Mes interventions": the only screen with the customer's contact details. */
export function InterventionsScreen({
  api,
  tailorId,
  refreshMs,
}: {
  api: TailorApi;
  tailorId: string;
  refreshMs: number;
}) {
  const styles = useStyles(screenStyles);
  const interventions = usePolled(
    useCallback(() => api.listInterventions(tailorId), [api, tailorId]),
    refreshMs,
  );
  const sorted = [...(interventions.data ?? [])].sort((a, b) => a.appointment.start.localeCompare(b.appointment.start));

  return (
    <View style={styles.list}>
      <ErrorText>{interventions.error}</ErrorText>
      {interventions.data === null ? (
        !interventions.error && <Text style={styles.empty}>Chargement des interventions…</Text>
      ) : sorted.length === 0 ? (
        <Text style={styles.empty}>Aucune intervention. Acceptez une proposition pour la retrouver ici.</Text>
      ) : (
        sorted.map((intervention) => (
          <InterventionCard
            key={intervention.id}
            api={api}
            tailorId={tailorId}
            intervention={intervention}
            onChanged={interventions.refresh}
          />
        ))
      )}
    </View>
  );
}

function InterventionCard({
  api,
  tailorId,
  intervention,
  onChanged,
}: {
  api: TailorApi;
  tailorId: string;
  intervention: Intervention;
  onChanged: () => Promise<void>;
}) {
  const styles = useStyles(cardStyles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { customer, appointment, status } = intervention;

  async function advance() {
    setBusy(true);
    setError(null);
    try {
      if (status === 'scheduled') await api.startIntervention(intervention.id, tailorId);
      else await api.completeIntervention(intervention.id, tailorId);
      await onChanged();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.when} role="heading" aria-level={2}>
          {formatDay(appointment.start)}, {formatTime(appointment.start)}
        </Text>
        <Badge label={STATUSES[status].label} tone={STATUSES[status].tone} />
      </View>

      <View style={styles.block}>
        <Text style={styles.name}>{customer.fullName}</Text>
        <Text style={styles.text}>
          {customer.address.street}, {customer.address.postalCode} {customer.address.city}
        </Text>
        <Text
          role="link"
          style={styles.phone}
          onPress={() => void Linking.openURL(`tel:${customer.phone.replace(/\s/g, '')}`)}
        >
          {customer.phone}
        </Text>
      </View>

      <View style={styles.block}>
        {intervention.workSheet.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the work sheet is fixed once the order is placed.
          <Text key={index} style={styles.text}>
            <Text style={styles.garment}>
              {garmentLabel(item.garmentType)} · {fabricLabel(item.fabric)}
            </Text>
            {'  '}
            {item.alterationCodes.join(', ')}
          </Text>
        ))}
      </View>

      <ErrorText>{error}</ErrorText>
      {(status === 'scheduled' || status === 'in-progress') && (
        <View style={styles.actions}>
          <Button
            label={status === 'scheduled' ? 'Démarrer' : 'Terminer'}
            accessibilityLabel={`${status === 'scheduled' ? 'Démarrer' : 'Terminer'} l’intervention chez ${customer.fullName}`}
            busy={busy}
            onPress={() => void advance()}
          />
        </View>
      )}
    </Card>
  );
}

const screenStyles = (c: Palette) => ({
  list: { gap: 12 },
  empty: { color: c.inkSoft, fontSize: 15, textAlign: 'center' as const, paddingVertical: 32 },
});

const cardStyles = (c: Palette) => ({
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  when: { color: c.ink, fontSize: 17, fontWeight: '700' as const, flexShrink: 1 },
  block: { gap: 2 },
  name: { color: c.ink, fontSize: 16, fontWeight: '600' as const },
  text: { color: c.inkSoft, fontSize: 15 },
  garment: { color: c.ink, fontWeight: '500' as const },
  phone: { color: c.thread, fontSize: 15, fontWeight: '500' as const, textDecorationLine: 'underline' as const },
  actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const },
});
