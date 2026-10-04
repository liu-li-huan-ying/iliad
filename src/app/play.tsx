import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  VideoView,
  useVideoPlayer,
  type VideoThumbnail,
} from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { videoUri } from '../lib/media';
import { readHistory, saveProgress } from '../lib/history';
import { formatClock, ratioOf, resumeAt } from '../lib/format';

const RATES = [0.75, 1, 1.25, 1.5, 2];
const THUMB_COUNT = 10;
const SAVE_INTERVAL_SECONDS = 5;

export default function PlayScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();
  const [uri, setUri] = useState<string | null>(null);
  const [detail, setDetail] = useState('');

  useEffect(() => {
    let alive = true;
    videoUri(id)
      .then((result) => {
        if (alive) {
          setUri(result);
        }
      })
      .catch((error) => {
        if (alive) {
          setDetail(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
    return () => {
      void ScreenOrientation.unlockAsync();
    };
  }, []);

  if (detail) {
    return (
      <Notice text={detail} onClose={() => router.back()} />
    );
  }

  if (!uri) {
    return <Notice text="Opening…" onClose={() => router.back()} />;
  }

  return <Playback id={id} title={name ?? 'video'} uri={uri} />;
}

function Playback({ id, title, uri }: { id: string; title: string; uri: string }) {
  const router = useRouter();
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.timeUpdateEventInterval = 1;
    instance.loop = false;
  });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [thumbs, setThumbs] = useState<VideoThumbnail[]>([]);
  const [notice, setNotice] = useState('');
  const [barWidth, setBarWidth] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [flash, setFlash] = useState<'l' | 'r' | null>(null);

  const holding = useRef(false);
  const lastTap = useRef({ at: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ position: 0, duration: 0 });
  const savedAtRef = useRef(0);

  useEffect(() => {
    const saved = readHistory()[id];
    const tapRef = lastTap;

    const onPlaying = player.addListener('playingChange', (event) => {
      setPlaying(event.isPlaying);
    });

    const onTime = player.addListener('timeUpdate', (event) => {
      latestRef.current = { position: event.currentTime, duration: player.duration };
      setTime(event.currentTime);
      if (player.playing && event.currentTime - savedAtRef.current >= SAVE_INTERVAL_SECONDS) {
        savedAtRef.current = event.currentTime;
        saveProgress(id, event.currentTime, player.duration);
      }
    });

    const onLoad = player.addListener('sourceLoad', (event) => {
      setDuration(event.duration);
      const start = saved ? resumeAt(saved.position, event.duration) : 0;
      if (start > 1) {
        player.seekBy(start);
        setTime(start);
        setNotice(`Resumed at ${formatClock(start)}`);
      }
      if (event.duration > 0) {
        const times = Array.from(
          { length: THUMB_COUNT },
          (_, index) => ((index + 0.5) / THUMB_COUNT) * event.duration
        );
        player
          .generateThumbnailsAsync(times, { maxWidth: 150 })
          .then(setThumbs)
          .catch(() => setThumbs([]));
      }
    });

    const onStatus = player.addListener('statusChange', (event) => {
      if (event.error) {
        setNotice(event.error.message ?? 'This file could not be played.');
      }
    });

    return () => {
      onPlaying.remove();
      onTime.remove();
      onLoad.remove();
      onStatus.remove();
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      if (tapRef.current.timer) {
        clearTimeout(tapRef.current.timer);
      }
      saveProgress(id, latestRef.current.position, latestRef.current.duration);
    };
  }, [player, id]);

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.min(Math.max(0, seconds), player.duration);
      player.seekBy(target - player.currentTime);
      setTime(target);
      setNotice('');
    },
    [player]
  );

  const applyRate = (value: number) => {
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = value;
  };

  const beginHold = () => {
    holding.current = true;
    applyRate(2);
  };

  const endHold = () => {
    if (!holding.current) {
      return;
    }
    holding.current = false;
    applyRate(rate);
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    applyRate(next);
  };

  const ratio = ratioOf(time, duration);

  const scheduleAutoHide = (visible: boolean) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (visible && playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3500);
    }
  };

  const togglePlay = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleStagePress = (x: number) => {
    if (holding.current) {
      return;
    }
    const now = Date.now();
    const isDouble = now - lastTap.current.at < 300;
    if (lastTap.current.timer) {
      clearTimeout(lastTap.current.timer);
      lastTap.current.timer = null;
    }
    lastTap.current.at = isDouble ? 0 : now;

    if (!isDouble) {
      lastTap.current.timer = setTimeout(() => {
        lastTap.current.timer = null;
        setControlsVisible((was) => {
          scheduleAutoHide(!was);
          return !was;
        });
      }, 300);
      return;
    }

    const third = Dimensions.get('window').width / 3;
    if (x < third) {
      seekTo(player.currentTime - 10);
      setFlash('l');
    } else if (x > third * 2) {
      seekTo(player.currentTime + 10);
      setFlash('r');
    } else {
      togglePlay();
    }
    setTimeout(() => setFlash(null), 400);
    setControlsVisible(true);
    scheduleAutoHide(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.chip}>
          <Text style={styles.chipText}>Library</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <Pressable
        style={styles.stage}
        onPress={(event) => handleStagePress(event.nativeEvent.locationX)}
        /* eslint-disable-next-line react-hooks/immutability -- expo-video 的 player 是可变原生对象，倍速只能靠属性写入，没有 setter */
        onLongPress={beginHold}
        /* eslint-disable-next-line react-hooks/immutability */
        onPressOut={endHold}
      >
        <VideoView player={player} contentFit="contain" style={styles.video} />
        {flash ? <View pointerEvents="none" style={[styles.flash, flash === 'l' ? styles.flashL : styles.flashR]}>
          <Text style={styles.flashText}>{flash === 'l' ? '-10' : '+10'}</Text>
        </View> : null}
        {!controlsVisible ? <View pointerEvents="none" style={styles.hiddenHint}><Text style={styles.timeText}>tap to show controls</Text></View> : null}
      </Pressable>

      {controlsVisible ? (
      <View style={styles.controls}>
        <View style={styles.times}>
          <Text style={styles.timeText}>{formatClock(time)}</Text>
          <Text style={styles.timeText}>{duration > 0 ? formatClock(duration) : '--:--'}</Text>
        </View>

        <View style={styles.barHit} onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}>
          <View style={styles.barRail}>
            <View style={[styles.barFill, { width: `${ratio * 100}%` }]} />
          </View>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(event) => {
              if (barWidth > 0 && duration > 0) {
                seekTo((event.nativeEvent.locationX / barWidth) * duration);
              }
            }}
          />
        </View>

        <View style={styles.buttons}>
          <RoundButton label="-10" onPress={() => seekTo(player.currentTime - 10)} />
          <RoundButton label={playing ? 'Pause' : 'Play'} onPress={togglePlay} />
          <RoundButton label="+10" onPress={() => seekTo(player.currentTime + 10)} />
          <RoundButton label={`${rate}x`} onPress={cycleRate} />
          <RoundButton
            label="Start"
            onPress={() => {
              saveProgress(id, 0, player.duration);
              seekTo(0);
            }}
          />
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {thumbs.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {thumbs.map((thumb, index) => (
              <Pressable
                key={index}
                onPress={() => seekTo(thumb.requestedTime)}
                style={styles.thumbBox}
              >
                <Image source={thumb} style={styles.thumb} contentFit="cover" transition={120} />
                <Text style={styles.thumbTime}>{formatClock(thumb.requestedTime)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      ) : null}
    </View>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.round} android_ripple={{ color: '#2a2a30' }}>
      <Text style={styles.roundText}>{label}</Text>
    </Pressable>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <View style={styles.noticeScreen}>
      <Text style={styles.noticeBody}>{text}</Text>
      <Pressable style={styles.chip} onPress={onClose}>
        <Text style={styles.chipText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0b0b0d' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingTop: 8 },
  title: { flex: 1, color: '#c9c9d0', fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7, backgroundColor: '#1f1f24' },
  chipText: { color: '#e8e8ea', fontSize: 13 },
  stage: { flex: 1, backgroundColor: '#000000' },
  video: { flex: 1 },
  controls: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18, gap: 12 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: '#8b8b93', fontSize: 12, fontVariant: ['tabular-nums'] },
  barHit: { height: 48, justifyContent: 'center' },
  barRail: { height: 4, borderRadius: 2, backgroundColor: '#232328', overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: '#c8a24a' },
  flash: { position: 'absolute', top: '50%', transform: [{ translateY: -28 }], width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(15,15,17,.6)', alignItems: 'center', justifyContent: 'center' },
  flashL: { left: 24 },
  flashR: { right: 24 },
  flashText: { color: '#c8a24a', fontSize: 13, fontFamily: 'monospace' },
  hiddenHint: { position: 'absolute', left: 16, bottom: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  round: {
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#1f1f24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: '#e8e8ea', fontSize: 13 },
  notice: { color: '#c8a24a', fontSize: 12 },
  strip: { gap: 8, paddingVertical: 2 },
  thumbBox: { gap: 3 },
  thumb: { width: 84, height: 48, borderRadius: 4, backgroundColor: '#17171b' },
  thumbTime: { color: '#8b8b93', fontSize: 12 },
  noticeScreen: {
    flex: 1,
    backgroundColor: '#0b0b0d',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 28,
  },
  noticeBody: { color: '#8b8b93', fontSize: 14, textAlign: 'center' },
});
