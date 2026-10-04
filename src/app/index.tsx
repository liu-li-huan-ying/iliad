import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureVideoPermission, listVideos, type VideoItem } from '../lib/media';
import { readHistory, type HistoryMap } from '../lib/history';
import { formatClock, ratioOf } from '../lib/format';

type Phase = 'loading' | 'ready' | 'denied' | 'failed';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<VideoItem[]>([]);
  const [history, setHistory] = useState<HistoryMap>({});
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!(await ensureVideoPermission())) {
        if (alive) {
          setPhase('denied');
        }
        return;
      }
      try {
        const videos = await listVideos();
        if (alive) {
          setItems(videos);
          setHistory(readHistory());
          setPhase('ready');
        }
      } catch (error) {
        if (alive) {
          setDetail(error instanceof Error ? error.message : String(error));
          setPhase('failed');
        }
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = () => setAttempt((current) => current + 1);

  if (phase === 'denied' || phase === 'failed' || phase === 'loading') {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.big}>iliad</Text>
        {phase === 'loading' ? <Text style={styles.body}>Reading your library…</Text> : null}
        {phase === 'denied' ? (
          <>
            <Text style={styles.body}>
              iliad plays videos that are already on this device. It needs the video part of your
              media library to list them.
            </Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Allow access</Text>
            </Pressable>
          </>
        ) : null}
        {phase === 'failed' ? (
          <>
            <Text style={styles.body}>The library could not be read.</Text>
            <Text style={styles.detail}>{detail}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.big}>iliad</Text>
        <Text style={styles.body}>
          {items.length === 0
            ? 'No videos found in the media library'
            : `${items.length} video${items.length === 1 ? '' : 's'}`}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VideoRow
            item={item}
            progress={history[item.id]}
            onPress={() =>
              router.push({
                pathname: '/play',
                params: { id: item.id, name: item.name },
              })
            }
          />
        )}
      />
    </View>
  );
}

function VideoRow({
  item,
  progress,
  onPress,
}: {
  item: VideoItem;
  progress?: { position: number; duration: number; updatedAt: number };
  onPress: () => void;
}) {
  const ratio = progress ? ratioOf(progress.position, progress.duration) : 0;
  const remaining =
    progress && item.duration ? Math.max(0, item.duration - progress.position) : null;

  return (
    <Pressable onPress={onPress} style={styles.row} android_ripple={{ color: '#1d1d21' }}>
      <Text style={styles.title} numberOfLines={2}>
        {item.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {item.duration ? formatClock(item.duration) : 'unknown length'}
        {ratio > 0.01 && remaining !== null ? `  ·  ${formatClock(remaining)} left` : ''}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  header: { paddingHorizontal: 18, paddingBottom: 12, gap: 4 },
  big: { color: '#f2f2f2', fontSize: 22, fontWeight: '500' },
  body: { color: '#8b8b93', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  detail: { color: '#5a5a63', fontSize: 12, textAlign: 'center' },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1f1f24',
  },
  buttonText: { color: '#f2f2f2', fontSize: 14 },
  row: { paddingHorizontal: 18, paddingVertical: 14, gap: 5, borderBottomWidth: 1, borderBottomColor: '#151518' },
  title: { color: '#e8e8ea', fontSize: 15 },
  meta: { color: '#75757d', fontSize: 12 },
  track: { height: 2, borderRadius: 1, backgroundColor: '#232328', overflow: 'hidden' },
  fill: { height: 2, backgroundColor: '#c8a24a' },
});
