import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PendingOffer, TailorApi } from './api';
import {
  appointmentStarts,
  describeError,
  fabricLabel,
  formatDay,
  formatExpiry,
  formatTime,
  garmentLabel,
} from './schedule';
import { Button, Card, ErrorText, type Palette, useStyles } from './theme';
import { usePolled } from './use-polled';

/** "Propositions en attente": the district and the slots, never the customer. */
export function OffersScreen({
  api,
  tailorId,
  refreshMs,
  now,
  onAccepted,
}: {
  api: TailorApi;
  tailorId: string;
  refreshMs: number;
  now: () => Date;
  onAccepted: () => void;
}) {
  const styles = useStyles(screenStyles);
  const offers = usePolled(
    useCallback(() => api.listOffers(tailorId), [api, tailorId]),
    refreshMs,
  );

  return (
    <View style={styles.list}>
      <ErrorText>{offers.error}</ErrorText>
      {offers.data === null ? (
        !offers.error && <Text style={styles.empty}>Chargement des propositions…</Text>
      ) : offers.data.length === 0 ? (
        <Text style={styles.empty}>Aucune proposition pour l’instant. Les nouvelles missions apparaissent ici.</Text>
      ) : (
        offers.data.map((offer) => (
          <OfferCard
            key={offer.missionId}
            api={api}
            tailorId={tailorId}
            offer={offer}
            now={now()}
            onAccepted={onAccepted}
            onChanged={offers.refresh}
          />
        ))
      )}
    </View>
  );
}

function OfferCard({
  api,
  tailorId,
  offer,
  now,
  onAccepted,
  onChanged,
}: {
  api: TailorApi;
  tailorId: string;
  offer: PendingOffer;
  now: Date;
  onAccepted: () => void;
  onChanged: () => Promise<void>;
}) {
  const styles = useStyles(cardStyles);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const starts = appointmentStarts(offer.slots, now);
  const days = groupByDay(starts);
  const expiry = formatExpiry(offer.expiresAt, now);

  async function act(action: 'accept' | 'decline') {
    setBusy(action);
    setError(null);
    try {
      if (action === 'accept' && picked) {
        await api.acceptOffer(offer.missionId, tailorId, picked);
        onAccepted();
      } else {
        await api.declineOffer(offer.missionId, tailorId);
      }
      await onChanged();
    } catch (caught) {
      setError(describeError(caught));
      setBusy(null);
    }
  }

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.district} role="heading" aria-level={2}>
          {offer.postalCode}
        </Text>
        {expiry && <Text style={styles.expiry}>{expiry}</Text>}
      </View>
      <Text style={styles.work}>
        {offer.garmentTypes.map(garmentLabel).join(', ')} · {offer.fabrics.map(fabricLabel).join(', ')}
      </Text>

      <Text style={styles.label}>Choisissez le rendez-vous (30 min)</Text>
      {days.length === 0 && <Text style={styles.hint}>Plus aucun créneau à venir.</Text>}
      {days.map(([day, times]) => (
        <View key={day} style={styles.day}>
          <Text style={styles.dayLabel}>{day}</Text>
          <View style={styles.times}>
            {times.map((start) => {
              const iso = start.toISOString();
              const selected = picked === iso;
              return (
                <Pressable
                  key={iso}
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${day} à ${formatTime(start)}`}
                  onPress={() => setPicked(iso)}
                  style={[styles.time, selected && styles.timeSelected]}
                >
                  <Text style={selected ? styles.timeLabelSelected : styles.timeLabel}>{formatTime(start)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button
          label="Décliner"
          variant="ghost"
          busy={busy === 'decline'}
          disabled={busy !== null}
          onPress={() => void act('decline')}
        />
        <Button
          label={picked ? `Accepter à ${formatTime(picked)}` : 'Accepter'}
          busy={busy === 'accept'}
          disabled={picked === null || busy !== null}
          onPress={() => void act('accept')}
        />
      </View>
    </Card>
  );
}

function groupByDay(starts: readonly Date[]): [string, Date[]][] {
  const days = new Map<string, Date[]>();
  for (const start of starts) {
    const day = formatDay(start);
    days.set(day, [...(days.get(day) ?? []), start]);
  }
  return [...days];
}

const screenStyles = (c: Palette) => ({
  list: { gap: 12 },
  empty: { color: c.inkSoft, fontSize: 15, textAlign: 'center' as const, paddingVertical: 32 },
});

const cardStyles = (c: Palette) => ({
  header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'baseline' as const },
  district: { color: c.ink, fontSize: 22, fontWeight: '700' as const },
  expiry: { color: c.thread, fontSize: 13, fontWeight: '600' as const },
  work: { color: c.inkSoft, fontSize: 15 },
  label: { color: c.ink, fontSize: 14, fontWeight: '600' as const, marginTop: 4 },
  hint: { color: c.inkSoft, fontSize: 14 },
  day: { gap: 6 },
  dayLabel: { color: c.inkSoft, fontSize: 13 },
  times: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6 },
  time: {
    minHeight: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timeSelected: { backgroundColor: c.thread, borderColor: c.thread },
  timeLabel: { color: c.ink, fontSize: 14, fontVariant: ['tabular-nums' as const] },
  timeLabelSelected: { color: c.onThread, fontSize: 14, fontWeight: '600' as const },
  actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8 },
});
