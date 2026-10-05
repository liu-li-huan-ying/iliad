import { Directory } from 'expo-file-system';

export type SourceKind = 'internal' | 'external' | 'cloud' | 'lan';

export type Source = {
  kind: SourceKind;
  label: string;
  detail: string;
  status: 'ready' | 'reserved';
};

export const SOURCES: Source[] = [
  { kind: 'internal', label: '内置存储', detail: 'MediaStore · 只读视频', status: 'ready' },
  { kind: 'external', label: '外置存储', detail: 'U 盘 / SD 卡 · 通过 SAF 选择目录', status: 'ready' },
  { kind: 'cloud', label: '网盘', detail: 'WebDAV · SMB · FTP — 预留接口', status: 'reserved' },
  { kind: 'lan', label: '局域网', detail: 'NAS / DLNA — 预留接口', status: 'reserved' },
];

let externalRoot: string | null = null;

export function getExternalRoot(): string | null {
  return externalRoot;
}

export async function pickExternalRoot(): Promise<string> {
  const directory = await Directory.pickDirectoryAsync(externalRoot ?? undefined);
  externalRoot = directory.uri;
  return directory.name;
}
