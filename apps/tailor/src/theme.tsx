import { type ReactNode, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

/* The site's atelier palette: chalk paper, ink, and the red of a basting thread. */
const LIGHT = {
  paper: '#f6f2ea',
  surface: '#fffdf8',
  ink: '#1f2430',
  inkSoft: '#5b6070',
  line: '#ddd5c6',
  thread: '#b8402f',
  threadSoft: '#f3dcd5',
  onThread: '#ffffff',
  error: '#9c2a1c',
  errorBg: '#fbe7e3',
  active: '#1f5fa8',
  activeBg: '#e7f0fb',
  done: '#2a7a3d',
  doneBg: '#e6f4e9',
  muted: '#6b7280',
  mutedBg: '#eceae4',
};

const DARK: typeof LIGHT = {
  paper: '#17191f',
  surface: '#20232b',
  ink: '#ece7dd',
  inkSoft: '#a7a9b2',
  line: '#353946',
  thread: '#e06a55',
  threadSoft: '#3a2420',
  onThread: '#17191f',
  error: '#ff9b8a',
  errorBg: '#3a2420',
  active: '#8fb8ee',
  activeBg: '#1b2a3d',
  done: '#86cf98',
  doneBg: '#19301f',
  muted: '#a7a9b2',
  mutedBg: '#2a2d36',
};

export type Palette = typeof LIGHT;
export type Tone = 'active' | 'done' | 'muted';

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

/** Styles that depend on the palette, rebuilt only when the color scheme changes. */
export function useStyles<T extends Parameters<typeof StyleSheet.create>[0]>(factory: (palette: Palette) => T): T {
  const palette = usePalette();
  // biome-ignore lint/correctness/useExhaustiveDependencies: the factory is a module-level constant.
  return useMemo(() => StyleSheet.create(factory(palette)), [palette]);
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles(buttonStyles);
  const palette = usePalette();
  const primary = variant === 'primary';
  return (
    <Pressable
      role="button"
      aria-label={accessibilityLabel ?? label}
      aria-disabled={disabled || busy}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.ghost,
        (disabled || busy) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {busy && <ActivityIndicator size="small" color={primary ? palette.onThread : palette.thread} />}
      <Text style={primary ? styles.primaryLabel : styles.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

const buttonStyles = (c: Palette) => ({
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  primary: { backgroundColor: c.thread },
  ghost: { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  primaryLabel: { color: c.onThread, fontSize: 15, fontWeight: '600' as const },
  ghostLabel: { color: c.ink, fontSize: 15, fontWeight: '500' as const },
});

export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const palette = usePalette();
  const colors = {
    active: [palette.active, palette.activeBg],
    done: [palette.done, palette.doneBg],
    muted: [palette.muted, palette.mutedBg],
  }[tone];
  return (
    <View style={{ backgroundColor: colors[1], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: colors[0], fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const styles = useStyles(cardStyles);
  return <View style={styles.card}>{children}</View>;
}

const cardStyles = (c: Palette) => ({
  card: {
    backgroundColor: c.surface,
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
});

export function ErrorText({ children }: { children: string | null }) {
  const palette = usePalette();
  if (children === null) return null;
  return (
    <Text
      role="alert"
      style={{ color: palette.error, backgroundColor: palette.errorBg, padding: 10, borderRadius: 8, fontSize: 14 }}
    >
      {children}
    </Text>
  );
}
