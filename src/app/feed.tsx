import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listShorts, videoUri, type VideoItem } from '../lib/media';
import { formatClock, ratioOf } from '../lib/format';
import { colors, mono, radius, touch, type as t } from '../lib/theme';

export default function FeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [items, setItems] = useState<VideoItem[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const shorts = await listShorts();
      if (!alive) {
        return;
      }
      setItems(shorts);
      const wanted = shorts.findIndex((clip) => clip.id === params.id);
      setCurrent(wanted >= 0 ? wanted : 0);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [params.id]);

  if (items.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.body}>正在准备短视频列表…</Text>
        <Pressable onPress={() => router.back()} style={styles.chip}>
          <Text style={styles.chipText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <PagerView
        style={styles.pager}
        orientation="vertical"
        initialPage={current}
        offscreenPageLimit={1}
        onPageSelected={(event) => setCurrent(event.nativeEvent.position)}
      >
        {items.map((item, index) => (
          <View key={String(index)} style={styles.page}>
            {index === current ? <ShortClip uriSource={item.id} /> : <View style={styles.page} />}
          </View>
        ))}
      </PagerView>

      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.chip}>
          <Text style={styles.chipText}>Library</Text>
        </Pressable>
        <Text style={styles.counter}>
          {current + 1} / {items.length}
        </Text>
      </View>

      <View style={styles.metaBar} pointerEvents="box-none">
        <Text style={styles.name} numberOfLines={2}>
          {items[current].name}
        </Text>
        <Text style={styles.detail}>
          {items[current].width && items[current].height
            ? `${items[current].width}×${items[current].height} · `
            : ''}
          {items[current].duration ? `${formatClock(items[current].duration)} · ` : ''}
          循环播放 · 不记进度
        </Text>
      </View>
    </View>
  );
}

function ShortClip({ uriSource }: { uriSource: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    let alive = true;
    videoUri(uriSource)
      .then((result) => {
        if (alive) {
          setUri(result);
        }
      })
      .catch((error) => {
        if (alive) {
          setProblem(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      alive = false;
    };
  }, [uriSource]);

  if (problem) {
    return <Text style={styles.body}>{problem}</Text>;
  }
  if (!uri) {
    return <Text style={styles.body}>载入中…</Text>;
  }
  return <ClipPlayer uri={uri} />;
}

function ClipPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
    instance.timeUpdateEventInterval = 0.25;
    instance.play();
  });
  const [ratio, setRatio] = useState(0);
  const [paused, setPaused] = useState(false);
  const holding = useRef(false);

  useEffect(() => {
    const onTime = player.addListener('timeUpdate', (event) => {
      setRatio(ratioOf(event.currentTime, player.duration));
    });
    return () => {
      onTime.remove();
    };
  }, [player]);

  const applyRate = (value: number) => {
    // expo-video exposes playbackRate only as a mutable property, not a method.
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = value;
  };

  const beginHold = () => {
    holding.current = true;
    applyRate(2);
  };

  const releaseHold = () => {
    if (!holding.current) {
      return;
    }
    holding.current = false;
    applyRate(1);
  };

  return (
    <Pressable
      style={styles.page}
      onPress={() => {
        if (holding.current) {
          return;
        }
        setPaused((was) => {
          if (was) {
            player.play();
          } else {
            player.pause();
          }
          return !was;
        });
      }}
      /* eslint-disable-next-line react-hooks/immutability -- expo-video 的 player 是可变原生对象，倍速只能靠属性写入，没有 setter */
      onLongPress={beginHold}
      /* eslint-disable-next-line react-hooks/immutability */
      onPressOut={releaseHold}
    >
      <VideoView
        player={player}
        contentFit="contain"
        surfaceType="textureView"
        nativeControls={false}
        style={StyleSheet.absoluteFill}
      />
      {paused ? (
        <View pointerEvents="none" style={styles.pauseBadge}>
          <Text style={styles.pauseGlyph}>▶</Text>
        </View>
      ) : null}
      <View style={styles.line} pointerEvents="none">
        <View style={[styles.lineFill, { width: `${ratio * 100}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pager: { flex: 1 },
  page: { flex: 1, backgroundColor: '#000' },
  topBar: { position: 'absolute', left: 16, right: 16, top: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { color: colors.text2, fontSize: t.meta, ...mono },
  chip: { minWidth: touch.min, height: touch.min, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.hairline, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: colors.text1, fontSize: t.label },
  metaBar: { position: 'absolute', left: 16, right: 88, bottom: 36 },
  name: { color: colors.text1, fontSize: t.body, lineHeight: 20 },
  detail: { color: colors.text2, fontSize: t.meta, marginTop: 6, ...mono },
  body: { color: colors.text2, fontSize: t.body },
  pauseBadge: { position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -31 }, { translateY: -31 }] },
  pauseGlyph: {
    width: 62,
    height: 62,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.11)',
    color: colors.accent,
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 62,
    backgroundColor: 'rgba(7,9,13,.78)',
  },
  line: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: 'rgba(255,255,255,.16)' },
  lineFill: { height: 2, backgroundColor: colors.accent },
});
