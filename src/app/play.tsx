import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer, type AudioTrack, type VideoThumbnail } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getCachedVideos, videoUri } from '../lib/media';
import { readHistory, saveProgress } from '../lib/history';
import { formatClock, isShortVideo, ratioOf, resumeAt } from '../lib/format';
import { showToast } from '../components/Toast';
import { colors, mono, motion, radius, touch, type as t } from '../lib/theme';

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];
const THUMB_COUNT = 10;
const SAVE_INTERVAL_SECONDS = 5;

type PanelKind = 'sub' | 'aud' | 'spd' | 'fit' | null;
type Hud = { icon: string; text: string; sub: string; key: number };

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
      <View style={styles.center}>
        <Text style={styles.centerBody}>{detail}</Text>
        <Pressable onPress={() => router.back()} style={styles.ghostBtn}>
          <Text style={styles.ghostText}>返回</Text>
        </Pressable>
      </View>
    );
  }
  if (!uri) {
    return <View style={styles.center} />;
  }
  return <Playback id={id} title={name ?? 'video'} uri={uri} />;
}

function Playback({ id, title, uri }: { id: string; title: string; uri: string }) {
  const router = useRouter();
  const meta = useMemo(() => getCachedVideos().find((item) => item.id === id), [id]);

  const player = useVideoPlayer({ uri }, (instance) => {
    instance.timeUpdateEventInterval = 0.25;
    instance.loop = false;
  });

  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [rate, setRate] = useState(1);
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [thumbs, setThumbs] = useState<VideoThumbnail[]>([]);
  const [notice, setNotice] = useState('');
  const [visible, setVisible] = useState(true);
  const [locked, setLocked] = useState(false);
  const [panel, setPanel] = useState<PanelKind>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [dragging, setDragging] = useState(false);
  const [trackW, setTrackW] = useState(0);

  const latest = useRef({ position: 0, duration: 0 });
  const savedAt = useRef(0);
  const holding = useRef(false);
  const tap = useRef({ at: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudFade = useMemo(() => new Animated.Value(0), []);

  const applyRate = useCallback(
    (value: number) => {
      // expo-video exposes playbackRate only as a mutable property, not a method.
      // eslint-disable-next-line react-hooks/immutability
      player.playbackRate = value;
    },
    [player],
  );

  const scheduleHide = useCallback(
    (show: boolean) => {
      if (hide.current) {
        clearTimeout(hide.current);
        hide.current = null;
      }
      if (show && player.playing && !locked) {
        hide.current = setTimeout(() => setVisible(false), motion.controlsHideAfter);
      }
    },
    [player, locked],
  );

  useEffect(() => {
    const saved = readHistory()[id];
    const tapRef = tap;

    const onPlaying = player.addListener('playingChange', (event) => {
      setPlaying(event.isPlaying);
      scheduleHide(true);
    });
    const onTime = player.addListener('timeUpdate', (event) => {
      latest.current = { position: event.currentTime, duration: player.duration };
      setBuffered(event.bufferedPosition);
      if (!dragging) {
        setTime(event.currentTime);
      }
      if (player.playing && event.currentTime - savedAt.current >= SAVE_INTERVAL_SECONDS) {
        savedAt.current = event.currentTime;
        saveProgress(id, event.currentTime, player.duration);
      }
    });
    const onLoad = player.addListener('sourceLoad', (event) => {
      setDuration(event.duration);
      const start = saved ? resumeAt(saved.position, event.duration) : 0;
      if (start > 1) {
        player.seekBy(start);
        setTime(start);
        setNotice(`已恢复上次进度 ${formatClock(start)}`);
        showToast('已恢复上次播放进度', `${formatClock(start)} / ${formatClock(event.duration)}`, 'ok');
      }
      if (event.duration > 0) {
        const times = Array.from(
          { length: THUMB_COUNT },
          (_, index) => ((index + 0.5) / THUMB_COUNT) * event.duration,
        );
        player
          .generateThumbnailsAsync(times, { maxWidth: 150 })
          .then(setThumbs)
          .catch(() => setThumbs([]));
      }
    });
    const onStatus = player.addListener('statusChange', (event) => {
      if (event.error) {
        setNotice(event.error.message ?? '这个文件放不了');
        showToast('警告', event.error.message ?? '解码或读取失败', 'warn');
      }
    });

    return () => {
      onPlaying.remove();
      onTime.remove();
      onLoad.remove();
      onStatus.remove();
      if (hide.current) {
        clearTimeout(hide.current);
      }
      if (tapRef.current.timer) {
        clearTimeout(tapRef.current.timer);
      }
      saveProgress(id, latest.current.position, latest.current.duration);
    };
  }, [player, id, dragging, scheduleHide]);

  const flashHud = useCallback(
    (icon: string, text: string, sub: string) => {
      setHud({ icon, text, sub, key: Date.now() });
      hudFade.setValue(0);
      Animated.sequence([
        Animated.timing(hudFade, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.delay(520),
        Animated.timing(hudFade, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    },
    [hudFade],
  );

  const seekTo = useCallback(
    (seconds: number) => {
      const target = Math.min(Math.max(0, seconds), player.duration);
      player.seekBy(target - player.currentTime);
      setTime(target);
    },
    [player],
  );

  const togglePlay = useCallback(() => {
    if (locked) {
      flashHud('lock', '屏幕已锁定', 'LOCK');
      return;
    }
    if (player.playing) {
      player.pause();
      flashHud('pause', '已暂停', 'PAUSE');
    } else {
      player.play();
      flashHud('play', '播放中', 'PLAY');
    }
  }, [player, locked, flashHud]);

  const jump = useCallback(
    (delta: number) => {
      if (locked) {
        return;
      }
      seekTo(player.currentTime + delta);
      flashHud(delta > 0 ? 'forward' : 'backward', `${delta > 0 ? '+' : '−'}${Math.abs(delta)}s`, delta > 0 ? '快进' : '快退');
      scheduleHide(true);
    },
    [player, seekTo, locked, flashHud, scheduleHide],
  );

  const beginHold = () => {
    if (locked) {
      return;
    }
    holding.current = true;
    applyRate(2);
    flashHud('forward', '2×', 'HOLD');
  };

  const endHold = () => {
    if (!holding.current) {
      return;
    }
    holding.current = false;
    applyRate(rate);
  };

  const stagePress = (x: number) => {
    if (holding.current || locked) {
      return;
    }
    const now = Date.now();
    const isDouble = now - tap.current.at < motion.tapConflict;
    if (tap.current.timer) {
      clearTimeout(tap.current.timer);
      tap.current.timer = null;
    }
    tap.current.at = isDouble ? 0 : now;

    if (!isDouble) {
      tap.current.timer = setTimeout(() => {
        tap.current.timer = null;
        setVisible((was) => {
          scheduleHide(!was);
          return !was;
        });
      }, motion.tapConflict);
      return;
    }

    const third = Dimensions.get('window').width / 3;
    if (x < third) {
      jump(-10);
    } else if (x > third * 2) {
      jump(10);
    } else {
      togglePlay();
    }
    setVisible(true);
  };

  const seekFromX = (x: number) => {
    if (trackW > 0 && duration > 0) {
      seekTo((Math.min(Math.max(0, x), trackW) / trackW) * duration);
    }
  };

  const ratio = ratioOf(time, duration);
  const bufRatio = ratioOf(buffered, duration);

  const pickTrack = (track: AudioTrack | null) => {
    // eslint-disable-next-line react-hooks/immutability -- expo-video tracks are mutable properties
    player.audioTrack = track;
    setPanel(null);
    showToast('音轨', track?.label ?? track?.language ?? '已切换', 'ok');
  };

  return (
    <View style={styles.screen}>
      <Pressable
        style={styles.stage}
        onPress={(event) => stagePress(event.nativeEvent.locationX)}
        /* eslint-disable-next-line react-hooks/immutability -- hold-to-fast-forward needs mutable hold state outside render */
        onLongPress={beginHold}
        /* eslint-disable-next-line react-hooks/immutability */
        onPressOut={endHold}
      >
        <VideoView player={player} contentFit={fit} nativeControls={false} style={StyleSheet.absoluteFill} />
        {locked ? (
          <Pressable onPress={() => { setLocked(false); setVisible(true); }} style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>已锁定 · 点此解锁</Text>
          </Pressable>
        ) : null}
        {hud ? (
          <Animated.View key={hud.key} pointerEvents="none" style={[styles.hud, { opacity: hudFade }]}>
            <View style={styles.hudRing}>
              <Text style={styles.hudGlyph}>{hud.icon === 'lock' ? '🔒' : hud.icon === 'pause' ? '❚❚' : hud.icon === 'play' ? '▶' : '⇄'}</Text>
            </View>
            <Text style={styles.hudText}>{hud.text}</Text>
            <Text style={styles.hudSub}>{hud.sub}</Text>
          </Animated.View>
        ) : null}
      </Pressable>

      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.topText}>
          <Text style={styles.fileName} numberOfLines={2}>{title}</Text>
          <View style={styles.tags}>
            {meta?.width && meta?.height ? <Tag>{`${meta.width}×${meta.height}`}</Tag> : <Tag>未知分辨率</Tag>}
            {meta ? <Tag>{isShortVideo(meta) ? '短视频' : '长视频'}</Tag> : null}
            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          </View>
        </View>
      </View>

      {visible && !locked ? (
        <View style={styles.dock}>
          {thumbs.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {thumbs.map((thumb, index) => (
                <Pressable key={index} onPress={() => { seekTo(thumb.requestedTime); flashHud('forward', formatClock(thumb.requestedTime), '跳转'); }} style={styles.thumbBox}>
                  <Image source={thumb} style={styles.thumb} contentFit="cover" transition={120} />
                  <Text style={styles.thumbTime}>{formatClock(thumb.requestedTime)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.progRow}>
            <Text style={styles.time}>{formatClock(time)}</Text>
            <View
              style={styles.trackHit}
              onLayout={(event) => setTrackW(event.nativeEvent.layout.width)}
              onStartShouldSetResponder={() => !locked}
              onMoveShouldSetResponder={() => !locked}
              onResponderGrant={(event) => {
                setDragging(true);
                seekFromX(event.nativeEvent.locationX);
              }}
              onResponderMove={(event) => seekFromX(event.nativeEvent.locationX)}
              onResponderRelease={() => {
                setDragging(false);
                scheduleHide(true);
              }}
              onResponderTerminate={() => setDragging(false)}
            >
              <View style={styles.rail}>
                <View style={[styles.buf, { width: `${bufRatio * 100}%` }]} />
                <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <View style={[styles.knob, { left: `${ratio * 100}%`, opacity: dragging ? 1 : 0 }]} />
              {dragging ? (
                <View style={[styles.bubble, { left: `${ratio * 100}%` }]}>
                  <Text style={styles.bubbleText}>{formatClock(time)} / {formatClock(duration)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.time, styles.timeRight]}>{formatClock(duration)}</Text>
          </View>

          <View style={styles.actions}>
            <HitBtn label="«" onPress={() => jump(-10)} />
            <HitBtn label={playing ? '❚❚' : '▶'} big onPress={togglePlay} />
            <HitBtn label="»" onPress={() => jump(10)} />
            <View style={styles.spacer} />
            <HitBtn label="CC" onPress={() => setPanel(panel === 'sub' ? null : 'sub')} />
            <HitBtn label="♪" onPress={() => setPanel(panel === 'aud' ? null : 'aud')} />
            <HitBtn label={`${rate}×`} onPress={() => setPanel(panel === 'spd' ? null : 'spd')} />
            <HitBtn label={fit === 'contain' ? '适应' : '填充'} onPress={() => setPanel(panel === 'fit' ? null : 'fit')} />
            <HitBtn label="锁" onPress={() => { setLocked(true); setVisible(false); flashHud('lock', '屏幕已锁定', 'LOCK'); }} />
          </View>
        </View>
      ) : null}

      <Panel open={panel === 'sub'} onClose={() => setPanel(null)} title="字幕 SUBTITLE">
        {player.availableSubtitleTracks.length === 0 ? (
          <Text style={styles.panelNote}>这个文件没有内嵌字幕。外挂 .srt / .ass 尚未接入（expo-video 只暴露内嵌轨），排在 v0.3。</Text>
        ) : (
          <Wrap>
            <Chip on={player.subtitleTrack == null} label="关闭" onPress={closeSubtitle} />
            {player.availableSubtitleTracks.map((track, index) => (
              <Chip
                key={index}
                on={player.subtitleTrack?.label === track.label}
                label={track.label ?? track.language ?? `轨道 ${index + 1}`}
                onPress={() => {
                  player.subtitleTrack = track;
                  setPanel(null);
                  showToast('字幕', `已切换到 ${track.label ?? track.language ?? '内嵌轨'}`, 'ok');
                }}
              />
            ))}
          </Wrap>
        )}
      </Panel>

      <Panel open={panel === 'aud'} onClose={() => setPanel(null)} title="音轨 AUDIO">
        {player.availableAudioTracks.length <= 1 ? (
          <Text style={styles.panelNote}>这个文件只有一条音轨。蓝牙输出切换不是一方 API，不做假控件。</Text>
        ) : (
          <Wrap>
            {player.availableAudioTracks.map((track, index) => (
              <Chip
                key={index}
                on={player.audioTrack?.id === track.id}
                label={track.label ?? track.language ?? `音轨 ${index + 1}`}
                onPress={() => pickTrack(track)}
              />
            ))}
          </Wrap>
        )}
      </Panel>

      <Panel open={panel === 'spd'} onClose={() => setPanel(null)} title="播放速度 SPEED">
        <Wrap>
          {RATES.map((value) => (
            <Chip key={value} on={value === rate} label={`${value}×`} onPress={() => { setRate(value); applyRate(value); setPanel(null); }} />
          ))}
        </Wrap>
      </Panel>

      <Panel open={panel === 'fit'} onClose={() => setPanel(null)} title="画幅 ASPECT">
        <Wrap>
          <Chip on={fit === 'contain'} label="适应屏幕 · 无裁切" onPress={() => { setFit('contain'); setPanel(null); }} />
          <Chip on={fit === 'cover'} label="填充屏幕 · 会裁边" onPress={() => { setFit('cover'); setPanel(null); }} />
        </Wrap>
        <Text style={styles.panelNote}>默认适应屏幕。调研显示 Shorts 与抖音对非 9:16 素材也是加黑边而不是裁切。</Text>
      </Panel>
    </View>
  );

  function closeSubtitle() {
    player.subtitleTrack = null;
    setPanel(null);
    showToast('字幕', '已关闭字幕', 'ok');
  }
}

function Tag({ children }: { children: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{children}</Text>
    </View>
  );
}

function HitBtn({ label, onPress, big }: { label: string; onPress: () => void; big?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.hit, big ? styles.hitBig : null]}>
      <Text style={[styles.hitText, big ? styles.hitTextBig : null]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on ? styles.chipOn : null]}>
      <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

function Wrap({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

function Panel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const slide = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: 320, useNativeDriver: true }).start();
  }, [open, slide]);

  return (
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.panel, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  stage: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  centerBody: { color: colors.text2, fontSize: t.body, textAlign: 'center' },
  ghostBtn: { minHeight: touch.min, paddingHorizontal: 18, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accentBorder },
  ghostText: { color: colors.accent, fontSize: t.label },

  topBar: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingTop: 48 },
  closeBtn: { width: touch.min, height: touch.min, borderRadius: radius.pill, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.hairline },
  closeText: { color: colors.text1, fontSize: 15 },
  topText: { flex: 1, gap: 6 },
  fileName: { color: colors.text1, fontSize: t.card, fontWeight: '500', lineHeight: 21 },
  tags: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  tag: { borderWidth: 1, borderColor: colors.text4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { color: colors.text2, fontSize: t.meta, ...mono },
  noticeText: { color: colors.accent, fontSize: t.meta, marginLeft: 4 },

  dock: { padding: 14, paddingBottom: 24, gap: 12, backgroundColor: 'rgba(5,6,8,.94)' },
  strip: { gap: 8, paddingVertical: 2 },
  thumbBox: { gap: 3 },
  thumb: { width: 84, height: 48, borderRadius: 4, backgroundColor: colors.hover },
  thumbTime: { color: colors.text2, fontSize: t.meta, ...mono },

  progRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  time: { color: colors.text2, fontSize: t.meta, ...mono, minWidth: 52 },
  timeRight: { textAlign: 'right' },
  trackHit: { flex: 1, height: 44, justifyContent: 'center' },
  rail: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,.14)', overflow: 'hidden' },
  buf: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,.10)' },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.accent },
  knob: { position: 'absolute', top: 15, width: 13, height: 13, borderRadius: 7, backgroundColor: '#fff', marginLeft: -6, shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  bubble: { position: 'absolute', bottom: 40, backgroundColor: 'rgba(7,9,13,.92)', borderWidth: 1, borderColor: colors.hairline, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4, marginLeft: -46 },
  bubbleText: { color: colors.text1, fontSize: t.meta, ...mono },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
  hit: { minWidth: touch.min, height: touch.min, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  hitBig: { width: 56, minWidth: 56 },
  hitText: { color: colors.text2, fontSize: t.label },
  hitTextBig: { color: colors.text1, fontSize: 17 },

  hud: { position: 'absolute', left: 0, right: 0, top: '42%', alignItems: 'center', gap: 8 },
  hudRing: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(7,9,13,.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,.11)', alignItems: 'center', justifyContent: 'center' },
  hudGlyph: { color: colors.text1, fontSize: 20 },
  hudText: { color: colors.text1, fontSize: 17, fontWeight: '600', ...mono },
  hudSub: { color: colors.text3, fontSize: t.meta, letterSpacing: 1 },
  lockBadge: { position: 'absolute', right: 16, bottom: 24, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(7,9,13,.7)', borderWidth: 1, borderColor: colors.hairline },
  lockBadgeText: { color: colors.text2, fontSize: t.meta },

  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,15,23,.98)', borderTopLeftRadius: radius.bar, borderTopRightRadius: radius.bar, borderTopWidth: 1, borderColor: colors.hairline, padding: 18, paddingBottom: 34, maxHeight: 300 },
  panelTitle: { color: colors.text3, fontSize: t.meta, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', marginBottom: 12 },
  panelNote: { color: colors.text2, fontSize: t.meta, lineHeight: 19 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,.11)', backgroundColor: colors.glass, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: touch.min, justifyContent: 'center' },
  chipOn: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  chipText: { color: colors.text2, fontSize: t.chip },
  chipTextOn: { color: colors.accent },
});
