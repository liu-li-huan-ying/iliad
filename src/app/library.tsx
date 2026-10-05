import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedVideos, type VideoItem } from '../lib/media';
import { readHistory } from '../lib/history';
import { formatClock, isShortVideo, ratioOf, SHORT_MAX_SECONDS } from '../lib/format';
import { colors, mono, radius, touch, type as t } from '../lib/theme';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [items] = useState<VideoItem[]>(() => getCachedVideos());
  const history = readHistory();
  const columns = width >= 840 ? 3 : width >= 600 ? 2 : 1;

  if (items.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.empty}>还没有扫描。返回主页点「内置存储」，授权后才会读取媒体库。</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.navMeta}>{items.length} 个视频</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const entry = history[item.id];
          const ratio = entry ? ratioOf(entry.position, entry.duration) : 0;
          const short = isShortVideo(item);
          return (
            <Pressable
              onPress={() =>
                router.push(short ? { pathname: '/feed', params: { id: item.id } } : { pathname: '/play', params: { id: item.id, name: item.name } })
              }
              style={[styles.card, columns > 1 ? styles.cardHalf : null]}
            >
              <View style={styles.thumb}>
                <Text style={styles.glyph}>▶</Text>
                {item.duration ? <Text style={styles.dur}>{formatClock(item.duration)}</Text> : null}
                {ratio > 0.02 ? <View style={[styles.thumbBar, { width: `${ratio * 100}%` }]} /> : null}
              </View>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.width && item.height ? `${item.width}×${item.height}` : '分辨率未知'}
                {'  ·  '}
                {short ? `短视频 ≤${SHORT_MAX_SECONDS}s` : '长视频'}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  back: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: colors.text2, fontSize: t.card },
  navMeta: { color: colors.text3, fontSize: t.meta, ...mono },
  grid: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  card: { backgroundColor: colors.card, borderRadius: radius.card, overflow: 'hidden', marginBottom: 4 },
  cardHalf: { flex: 1, minWidth: '47%' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.hover, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: 'rgba(255,255,255,.22)', fontSize: 22 },
  dur: { position: 'absolute', right: 6, bottom: 6, color: colors.text1, fontSize: t.meta, backgroundColor: 'rgba(4,5,7,.86)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, ...mono },
  thumbBar: { position: 'absolute', left: 0, bottom: 0, height: 1.5, backgroundColor: colors.accent },
  name: { color: colors.text1, fontSize: t.label, paddingHorizontal: 12, paddingTop: 10 },
  meta: { color: colors.text2, fontSize: t.meta, paddingHorizontal: 12, paddingBottom: 12, marginTop: 4, ...mono },
  empty: { color: colors.text2, fontSize: t.body, textAlign: 'center', marginTop: 60 },
});
