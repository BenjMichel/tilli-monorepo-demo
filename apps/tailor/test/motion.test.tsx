import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityInfo, Animated, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionPressable, MotionProvider, MotionView } from '../src/motion';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('optional motion', () => {
  it('keeps actions available without animation when reduced motion is enabled', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const timing = vi.spyOn(Animated, 'timing');
    const onPress = vi.fn();
    render(
      <MotionProvider>
        <MotionPressable role="button" onPress={onPress} style={() => ({ minHeight: 44 })}>
          <Text>Choisir</Text>
        </MotionPressable>
      </MotionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Choisir' }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Choisir' })).minHeight).toBe('44px');
    expect(timing).not.toHaveBeenCalled();
  });

  it('does not let an old preference query override a live change', async () => {
    let resolvePreference: (value: boolean) => void = () => {};
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise((resolve) => {
        resolvePreference = resolve;
      }),
    );
    let changePreference: (value: boolean) => void = () => {};
    const remove = vi.fn();
    vi.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, handler) => {
      changePreference = handler as (value: boolean) => void;
      return { remove };
    });
    const timing = vi.spyOn(Animated, 'timing');
    const { unmount } = render(
      <MotionProvider>
        <MotionView>
          <Text>Mission</Text>
        </MotionView>
      </MotionProvider>,
    );
    await act(async () => {
      changePreference(true);
      resolvePreference(false);
    });
    expect(timing).not.toHaveBeenCalled();
    unmount();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('does not replay a card entrance when refreshed data changes its content', async () => {
    vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const timing = vi.spyOn(Animated, 'timing');
    const { rerender } = render(
      <MotionProvider>
        <MotionView>
          <Text>Mission</Text>
        </MotionView>
      </MotionProvider>,
    );
    await act(async () => {});
    const calls = timing.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    rerender(
      <MotionProvider>
        <MotionView>
          <Text>Mission actualisée</Text>
        </MotionView>
      </MotionProvider>,
    );
    expect(timing).toHaveBeenCalledTimes(calls);
  });
});
