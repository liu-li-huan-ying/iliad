import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showToast } from '../components/Toast';
import { SHORT_FALLBACK_SECONDS, SHORT_MAX_SECONDS } from '../lib/format';
import { colors, mono, radius, touch, type as t } from '../lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable hitSlop={8} onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ 返回</Text>
        </Pressable>
        <Text style={styles.brand}>ILIAD</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.version}>iliad 0.2 · Expo SDK 57 · RN 0.86.3</Text>

        <Text style={styles.group}>播放</Text>
        <Row label="解码与硬件加速" sub="由 ExoPlayer 决定，应用层不暴露开关" value="MediaCodec" onPress={() => showToast('解码引擎', 'expo-video 在安卓走 ExoPlayer，硬解优先，当前没有可配置的开关')} />
        <Row label="手势与按键" sub="双击 ±10s / 单击显隐 / 长按 2x" value="已配置" onPress={() => showToast('手势', '长视频用 VLC 范式，短视频用平台范式，两张表见设计稿 §4.3')} />
        <Row label="字幕" sub="内嵌 / 外挂尚未接入" value="未实现" onPress={() => showToast('字幕', 'expo-video 有 subtitleTrack API，UI 还没接，排在 v0.3')} />
        <Row label="默认画幅" sub="适应屏幕 · 不裁切" value="contain" onPress={() => showToast('画幅', '两态都用 contain + 黑边：调研显示 Shorts 与抖音对非 9:16 素材也是加黑边，不是裁切或模糊')} />

        <Text style={styles.group}>分流判据</Text>
        <Row label="短视频时长上限" sub="竖屏且不超过此值才进短视频流" value={`${SHORT_MAX_SECONDS}s`} onPress={() => showToast('阈值', '常量在 src/lib/format.ts，改成可持久化开关需要先加设置存储，目前只能改代码')} />
        <Row label="宽高未知时的兜底" sub="MediaStore 可能不返回 width/height" value={`${SHORT_FALLBACK_SECONDS}s`} onPress={() => showToast('兜底', '拿不到宽高就退化成这条阈值，列表上仍可手动进两种形态')} />

        <Text style={styles.group}>数据源</Text>
        <Row label="内置存储" sub="MediaStore · 只读视频" value="已接入" onPress={() => showToast('LocalSource', '只申请 READ_MEDIA_VIDEO，不联网、不上传')} />
        <Row label="外置存储" sub="U 盘 / SD 卡 · SAF 选择目录" value="部分" onPress={() => showToast('SAF', '能选到目录并拿到持久授权；递归列举视频还没做')} />
        <Row label="网盘 / 局域网" sub="WebDAV · SMB · FTP · DLNA" value="预留" disabled />

        <Text style={styles.group}>关于</Text>
        <Row label="关于 iliad" sub="不导入、不拷贝，直接读取本地文件" value="" onPress={() => showToast('iliad', 'MIT · 琉璃幻影 · 进度存应用文档目录的 history.json')} />
      </ScrollView>
    </View>
  );
}

function Row({
  label,
  sub,
  value,
  onPress,
  disabled,
}: {
  label: string;
  sub: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.row, disabled ? styles.rowOff : null]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  back: { minHeight: touch.min, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: colors.text2, fontSize: t.card },
  brand: { color: colors.text3, fontSize: t.label, fontWeight: '700', letterSpacing: 2 },
  body: { padding: 20, paddingBottom: 48 },
  version: { color: colors.text2, fontSize: t.meta, ...mono, marginBottom: 20 },
  group: { color: colors.text3, fontSize: t.meta, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '600', marginTop: 22, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: touch.min, paddingVertical: 11, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.card, marginBottom: 6 },
  rowOff: { opacity: 0.4 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { color: colors.text1, fontSize: t.label },
  rowSub: { color: colors.text2, fontSize: t.meta },
  rowValue: { color: colors.accent, fontSize: t.meta, ...mono },
});
