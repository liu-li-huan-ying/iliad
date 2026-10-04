import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureVideoPermission, listVideos, type VideoItem } from '../lib/media';
import { readHistory, type HistoryMap } from '../lib/history';
import { formatClock, isShortVideo, ratioOf } from '../lib/format';
import { columnsForWidth } from '../lib/layout';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'denied' | 'failed'>('idle');
  const [items, setItems] = useState<VideoItem[]>([]);
  const [history, setHistory] = useState<HistoryMap>({});
  const [detail, setDetail] = useState('');

  const load = async () => {
    setPhase('loading');
    if (!(await ensureVideoPermission())) {
      setPhase('denied');
      return;
    }
    try {
      const videos = await listVideos();
      setItems(videos);
      setHistory(readHistory());
      setPhase('ready');
    } catch (error) {
      setDetail(error instanceof Error ? error.message : String(error));
      setPhase('failed');
    }
  };

  const shorts = items.filter(isShortVideo);

  const openItem = (item: VideoItem) => {
    if (isShortVideo(item)) {
      router.push({ pathname: '/feed', params: { index: String(shorts.findIndex((s) => s.id === item.id)) } });
      return;
    }
    router.push({ pathname: '/play', params: { id: item.id, name: item.name } });
  };

  if (phase === 'denied' || phase === 'failed') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.title}>iliad</Text>
        <Text style={styles.body}>
          {phase === 'denied'
            ? '没有视频读取权限就没有内容可放。系统规则是连续拒绝两次后不再弹框，那时只能去系统设置里打开。'
            : '媒体库读取失败。'}
        </Text>
        {phase === 'failed' ? <Text style={styles.detail}>{detail}</Text> : null}
        <Pressable style={styles.button} onPress={() => void load()}>
          <Text style={styles.buttonText}>再次申请</Text>
        </Pressable>
        <Pressable style={styles.buttonGhost} onPress={() => void Linking.openSettings()}>
          <Text style={styles.buttonText}>打开系统设置</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>iliad</Text>
        <Text style={styles.count}>
          {phase === 'ready'
            ? `${items.length} video${items.length === 1 ? '' : 's'} · ${shorts.length} 短视频`
            : '还没有读取设备上的视频'}
        </Text>
      </View>

      {phase !== 'ready' ? (
        <View style={styles.scan}>
          <Text style={styles.scanBody}>
            {phase === 'loading' ? '正在读取媒体库…' : '按下按钮才会申请权限——系统要求用到时再问，不在启动时拦你。'}
          </Text>
          {phase === 'idle' ? (
            <Pressable style={styles.button} onPress={() => void load()}>
              <Text style={styles.buttonText}>扫描本地视频</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {phase === 'ready' ? (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={columnsForWidth(width)}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <VideoRow item={item} progress={history[item.id]} wide={width >= 600} onPress={() => openItem(item)} />
          )}
        />
      ) : null}
    </View>
  );
}

function VideoRow({
  item,
  progress,
  onPress,
  wide,
}: {
  item: VideoItem;
  progress?: { position: number; duration: number; updatedAt: number };
  onPress: () => void;
  wide: boolean;
}) {
  const ratio = progress ? ratioOf(progress.position, progress.duration) : 0;
  const left = progress && item.duration ? Math.max(0, item.duration - progress.position) : null;
  const short = isShortVideo(item);

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#1d1d21' }}
      style={[styles.row, wide ? styles.rowWide : null]}
    >
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {item.duration ? formatClock(item.duration) : 'unknown length'}
        {'  ·  '}
        <Text style={[styles.tag, short ? styles.tagShort : null]}>{short ? '短视频' : '长视频'}</Text>
        {ratio > 0.01 && left !== null ? `  ·  ${formatClock(left)} left` : ''}
      </Text>
      {ratio > 0.01 ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0b0d' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14, backgroundColor: '#0b0b0d' },
  header: { paddingHorizontal: 18, paddingBottom: 12, gap: 4 },
  title: { color: '#f2f2f2', fontSize: 22, fontWeight: '500' },
  count: { color: '#8b8b93', fontSize: 12 },
  body: { color: '#8b8b93', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  detail: { color: '#8b8b93', fontSize: 12, textAlign: 'center' },
  scan: { marginHorizontal: 18, marginBottom: 14, padding: 14, gap: 10, borderRadius: 10, borderWidth: 1, borderColor: '#6b5726', backgroundColor: 'rgba(200,162,74,.06)' },
  scanBody: { color: '#8b8b93', fontSize: 12.5, lineHeight: 20 },
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#2c2415', alignItems: 'center', justifyContent: 'center' },
  buttonGhost: { minHeight: 48, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#1f1f24', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#e8e8ea', fontSize: 14 },
  row: { flex: 1, minHeight: 72, paddingHorizontal: 18, paddingVertical: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: '#151518', justifyContent: 'center' },
  rowWide: { borderTopWidth: 1, borderTopColor: '#151518', marginHorizontal: 6 },
  name: { color: '#e8e8ea', fontSize: 15, lineHeight: 20 },
  meta: { color: '#8b8b93', fontSize: 12 },
  tag: { color: '#8b8b93', fontSize: 12 },
  tagShort: { color: '#c8a24a' },
  track: { height: 2, borderRadius: 1, backgroundColor: '#232328', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: '#c8a24a' },
});
