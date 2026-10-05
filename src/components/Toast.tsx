import { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, motion, radius, type as t } from '../lib/theme';

export type ToastKind = 'event' | 'ok' | 'warn';
export type ToastMessage = { title: string; message: string; kind: ToastKind; key: number };

let listener: ((message: ToastMessage) => void) | null = null;

export function showToast(title: string, message: string, kind: ToastKind = 'event') {
  listener?.({ title, message, kind, key: Date.now() });
}

export function ToastHost() {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const shift = useMemo(() => new Animated.Value(12), []);
  const fade = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    listener = (message) => {
      setCurrent(message);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(shift, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]).start();
    };
    return () => {
      listener = null;
    };
  }, [fade, shift]);

  useEffect(() => {
    if (!current) {
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCurrent(null));
    }, motion.toast);
    return () => clearTimeout(timer);
  }, [current, fade]);

  if (!current) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.card,
          current.kind === 'warn' ? styles.warn : null,
          { opacity: fade, transform: [{ translateY: shift }] },
        ]}
      >
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 22 },
  card: {
    backgroundColor: 'rgba(11,15,23,.97)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  warn: { borderLeftColor: colors.warn },
  title: { color: colors.text3, fontSize: t.meta - 1, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  body: { color: colors.text2, fontSize: t.meta },
});
