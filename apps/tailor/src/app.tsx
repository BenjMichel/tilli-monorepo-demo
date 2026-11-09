import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { TailorApi } from './api';
import { InterventionsScreen } from './interventions-screen';
import { OffersScreen } from './offers-screen';
import { Button, type Palette, useStyles } from './theme';

/** The demo tailors seeded by the API (ADR 0005). No authentication: the tailor picks who they are. */
export const DEMO_TAILORS = ['marie', 'karim', 'sofia', 'lucas'] as const;

type Tab = 'offers' | 'interventions';

export function App({
  api,
  refreshMs = 5_000,
  now = () => new Date(),
}: {
  api: TailorApi;
  refreshMs?: number;
  now?: () => Date;
}) {
  const styles = useStyles(appStyles);
  const [tailorId, setTailorId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('offers');

  return (
    <View style={styles.app}>
      <View style={styles.topbar}>
        <Text style={styles.brand}>
          Tilli <Text style={styles.brandSection}>Atelier</Text>
        </Text>
        {tailorId && (
          <Button label={`${capitalize(tailorId)} · changer`} variant="ghost" onPress={() => setTailorId(null)} />
        )}
      </View>

      {tailorId === null ? (
        <View style={styles.picker}>
          <Text style={styles.title} role="heading" aria-level={1}>
            Qui êtes-vous ?
          </Text>
          {DEMO_TAILORS.map((id) => (
            <Button
              key={id}
              label={capitalize(id)}
              variant="ghost"
              onPress={() => {
                setTailorId(id);
                setTab('offers');
              }}
            />
          ))}
        </View>
      ) : (
        <>
          <View style={styles.tabs} role="tablist">
            <TabButton label="Propositions" active={tab === 'offers'} onPress={() => setTab('offers')} />
            <TabButton
              label="Mes interventions"
              active={tab === 'interventions'}
              onPress={() => setTab('interventions')}
            />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            {tab === 'offers' ? (
              <OffersScreen
                api={api}
                tailorId={tailorId}
                refreshMs={refreshMs}
                now={now}
                onAccepted={() => setTab('interventions')}
              />
            ) : (
              <InterventionsScreen api={api} tailorId={tailorId} refreshMs={refreshMs} />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles(appStyles);
  return (
    <Pressable role="tab" aria-selected={active} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={active ? styles.tabLabelActive : styles.tabLabel}>{label}</Text>
    </Pressable>
  );
}

const capitalize = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

const appStyles = (c: Palette) => ({
  app: { flex: 1, backgroundColor: c.paper },
  topbar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    backgroundColor: c.surface,
  },
  brand: { color: c.ink, fontSize: 20, fontWeight: '700' as const },
  brandSection: { color: c.thread, fontWeight: '500' as const },
  picker: { padding: 16, gap: 10, width: '100%' as const, maxWidth: 480, alignSelf: 'center' as const },
  title: { color: c.ink, fontSize: 24, fontWeight: '700' as const, marginBottom: 6 },
  tabs: {
    flexDirection: 'row' as const,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: c.thread },
  tabLabel: { color: c.inkSoft, fontSize: 15 },
  tabLabelActive: { color: c.ink, fontSize: 15, fontWeight: '600' as const },
  content: { padding: 16, width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const },
});
