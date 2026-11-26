import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  type PressableProps,
  type ViewProps,
} from 'react-native';

const MotionContext = createContext(false);
const nativeDriver = Platform.OS !== 'web';

/** Stay still until the system preference is known; subscribe once for the whole app. */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let current = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => {
      changed = true;
      if (current) setEnabled(!reduce);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (reduce) => {
        if (current && !changed) setEnabled(!reduce);
      },
      () => {},
    );
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return <MotionContext.Provider value={enabled}>{children}</MotionContext.Provider>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Preserve the original hit area, layout, semantics and action timing. */
export function MotionPressable({ style, onPressIn, onPressOut, disabled, ...props }: PressableProps) {
  const enabled = useContext(MotionContext);
  const [pressed, setPressed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    scale.stopAnimation();
    if (!enabled || disabled) {
      scale.setValue(1);
      return;
    }
    const animation = Animated.timing(scale, {
      toValue: pressed ? 0.97 : 1,
      duration: pressed ? 90 : 170,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [enabled, disabled, pressed, scale]);
  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={[typeof style === 'function' ? style({ pressed }) : style, { transform: [{ scale }] }]}
    />
  );
}

/** Cards enter once on mount, never on a background data refresh. */
export function MotionView({ style, ...props }: ViewProps) {
  const enabled = useContext(MotionContext);
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (!enabled) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [enabled, progress]);
  return (
    <Animated.View
      {...props}
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
        },
      ]}
    />
  );
}
