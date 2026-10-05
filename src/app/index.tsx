import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ensureVideoPermission, getCachedVideos, listVideos, mediaBackend, mediaFailure } from '../lib/media';
import { readHistory } from '../lib/history';
import { isShortVideo, ratioOf } from '../lib/format';
import { pickExternalRoot, SOURCES } from '../lib/sources';
import { showToast } from '../components/Toast';
import { colors, mono, radius, touch, type as t } from '../lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<'internal' | 'external' | 'cloud' | 'lan'>('internal');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'denied'>('idle');
  const [externalName, setExternalName] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const scan = async () => {
    setPhase('loading');
    if (!(await ensureVideoPermission())) {
      const noModule = mediaBackend() === 'none';
      setReason(noModule ? mediaFailure() : '没有视频读取权限就没有内容可放');
      setPhase('denied');
      showToast('警告', noModule ? '这个客户端没有媒体库原生模块' : '没有视频读取权限');
      return;
    }
    try {
      await listVideos();
      setPhase('ready');
    } catch (error) {
      setReason(error instanceof Error ? error.message : '媒体库读取失败');
      setPhase('denied');
      showToast('警告', error instanceof Error ? error.message : '媒体库读取失败');
    }
  };

  const openExternal = async () => {
    try {
      const name = await pickExternalRoot();
      setExternalName(name);
      showToast('已选择目录', `${name} · 递归列举在下一步实现，现在只记住根目录`);
    } catch (error) {
      showToast('警告', error instanceof Error ? error.message : '已取消选择');
    }
  };

  const cached = getCachedVideos();
  const history = phase === 'ready' ? readHistory() : {};
  const resume = cached
    .filter((item) => history[item.id] && ratioOf(history[item.id].position, history[item.id].duration) > 0.02)
    .slice(0, 8);
  const columns = width >= 840 ? 3 : 2;

  return (
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.brand}>ILIAD</Text>
        <Pressable hitSlop={8} onPress={() => router.push('/settings')} style={styles.navBtn}>
          <Text style={styles.navBtnText}>设置</Text>
        </Pressable>
      </View>

      <View style={styles.seg}>
        {SOURCES.map((source) => {
          const active = source.kind === tab;
          const reserved = source.status === 'reserved';
          return (
            <Pressable
              key={source.kind}
              onPress={() => {
                setTab(source.kind);
                if (reserved) {
                  showToast('警告', `「${source.label}」是网络功能，当前版本只做本地播放`);
                }
              }}
              style={[styles.segBtn, active ? styles.segBtnOn : null, reserved ? styles.segDim : null]}
            >
              <Text style={[styles.segLabel, active ? styles.segLabelOn : null]}>{source.label}</Text>
              <Text style={styles.segSub}>{reserved ? '即将支持' : source.kind === 'external' ? 'SAF' : '已接入'}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageH}>设备与源</Text>

        <Pressable onPress={() => (phase === 'ready' ? router.push('/library') : void scan())} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardName} numberOfLines={1}>内置存储</Text>
            <Text style={[styles.status, phase === 'ready' ? styles.statusOn : null]}>
              {phase === 'ready' ? '已扫描' : phase === 'loading' ? '扫描中…' : '待扫描'}
            </Text>
          </View>
          <Text style={styles.cardMeta}>
            {phase === 'ready' ? `${cached.length} 个视频` : '点按后才申请权限，读取 MediaStore 里的视频'}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: phase === 'ready' ? '100%' : '0%' }]} />
          </View>
        </Pressable>

        <Pressable onPress={() => void openExternal()} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardName} numberOfLines={1}>{externalName ?? '外置存储'}</Text>
            <Text style={[styles.status, externalName ? styles.statusOn : null]}>
              {externalName ? '已选择' : '未接入'}
            </Text>
          </View>
          <Text style={styles.cardMeta}>
            {externalName
              ? `${externalName} · 递归列举待实现`
              : 'U 盘 / SD 卡插入后点这里选择目录（安卓要求用户亲自授权）'}
          </Text>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: externalName ? '35%' : '0%' }]} />
          </View>
        </Pressable>

        {SOURCES.filter((s) => s.status === 'reserved').map((source) => (
          <View key={source.kind} style={[styles.card, styles.cardReserved]}>
            <View style={styles.cardHead}>
              <Text style={styles.cardName}>{source.label}</Text>
              <Text style={styles.status}>即将支持</Text>
            </View>
            <Text style={styles.cardMeta}>{source.detail}</Text>
            <View style={styles.bar} />
          </View>
        ))}

        {phase === 'denied' ? (
          <View style={styles.deniedBox}>
            <Text style={styles.deniedText}>{reason}</Text>
            <Pressable onPress={() => void scan()} style={styles.retry}>
              <Text style={styles.retryText}>重新扫描本地视频</Text>
            </Pressable>
          </View>
        ) : null}

        {resume.length > 0 ? (
          <>
            <Text style={styles.section}>继续观看</Text>
            <View style={styles.grid}>
              {resume.map((item) => {
                const entry = history[item.id];
                const ratio = ratioOf(entry.position, entry.duration);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() =>
                      router.push(
                        isShortVideo(item)
                          ? { pathname: '/feed', params: { id: item.id } }
                          : { pathname: '/play', params: { id: item.id, name: item.name } },
                      )
                    }
                    style={[styles.tile, { width: `${100 / columns - 2}%` }]}
                  >
                    <View style={styles.thumb}>
                      <Text style={styles.thumbGlyph}>▶</Text>
                      <View style={[styles.thumbBar, { width: `${ratio * 100}%` }]} />
                    </View>
                    <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.tileMeta}>{Math.round(ratio * 100)}% 已看</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  brand: { color: colors.text3, fontSize: t.label, fontWeight: '700', letterSpacing: 2 },
  navBtn: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 10 },
  navBtnText: { color: colors.text2, fontSize: t.label },
  seg: { flexDirection: 'row', marginHorizontal: 16, padding: 3, backgroundColor: colors.card, borderRadius: radius.pill },
  segBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.pill, alignItems: 'center', gap: 1 },
  segBtnOn: { backgroundColor: colors.hover },
  segDim: { opacity: 0.55 },
  segLabel: { color: colors.text3, fontSize: t.label },
  segLabelOn: { color: colors.text1 },
  segSub: { color: colors.text3, fontSize: 11, letterSpacing: 0.8 },
  body: { padding: 20, paddingBottom: 40 },
  pageH: { color: colors.text1, fontSize: t.page, fontWeight: '600', marginBottom: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 16,
    marginBottom: 10,
    gap: 8,
  },
  cardReserved: { opacity: 0.4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardName: { color: colors.text1, fontSize: t.card, fontWeight: '500', flexShrink: 1 },
  status: { color: colors.text3, fontSize: t.meta },
  statusOn: { color: colors.accent },
  cardMeta: { color: colors.text2, fontSize: t.meta, lineHeight: 18 },
  bar: { height: 3, borderRadius: 2, backgroundColor: colors.hover, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2, backgroundColor: colors.accent },
  deniedBox: { gap: 10, marginTop: 6 },
  deniedText: { color: colors.text2, fontSize: t.meta, lineHeight: 19 },
  retry: { alignSelf: 'flex-start', minHeight: touch.min, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accentBorder, marginTop: 6 },
  retryText: { color: colors.accent, fontSize: t.label },
  section: { color: colors.text3, fontSize: t.meta, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '600', marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: '1%' },
  tile: { marginBottom: 12, gap: 5 },
  thumb: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.sm, backgroundColor: colors.hover, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbGlyph: { color: 'rgba(255,255,255,.22)', fontSize: 20 },
  thumbBar: { position: 'absolute', left: 0, bottom: 0, height: 1.5, backgroundColor: colors.accent },
  tileName: { color: colors.text1, fontSize: t.label },
  tileMeta: { color: colors.text2, fontSize: t.meta, ...mono },
});
