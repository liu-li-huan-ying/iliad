import { isShortVideo } from './format';

declare const require: (id: string) => any;

type NextModule = {
  Query: new () => {
    eq: (field: string, value: string) => any;
    orderBy: (descriptor: { key: string; ascending: boolean }) => any;
    exeForMetadata: () => Promise<any[]>;
  };
  AssetField: Record<string, string>;
  MediaType: Record<string, string>;
  Asset: new (id: string) => { getUri: () => Promise<string> };
  getPermissionsAsync: (writeOnly?: boolean, granular?: string[]) => Promise<{ granted: boolean }>;
  requestPermissionsAsync: (writeOnly?: boolean, granular?: string[]) => Promise<{ granted: boolean }>;
};

type LegacyModule = {
  getAssetsAsync: (options: { mediaType: string; first: number }) => Promise<{ assets: any[] }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
};

export type VideoItem = {
  id: string;
  name: string;
  duration: number | null;
  creationTime: number | null;
  width: number | null;
  height: number | null;
  uri?: string;
};

let next: NextModule | null = null;
let legacy: LegacyModule | null = null;
let missing = '';
let cache: VideoItem[] = [];

// The new API needs the ExpoMediaLibraryNext native module, which some clients
// (Expo Go) do not ship, so both bindings are resolved lazily.
function loadApi(): boolean {
  if (next || legacy) {
    return true;
  }
  try {
    next = require('expo-media-library') as NextModule;
    return true;
  } catch (error) {
    missing = `expo-media-library: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    legacy = require('expo-media-library/legacy') as LegacyModule;
    return true;
  } catch (error) {
    missing += ` | legacy: ${error instanceof Error ? error.message : String(error)}`;
  }
  return false;
}

export function mediaBackend(): 'next' | 'legacy' | 'none' {
  if (!next && !legacy) {
    loadApi();
  }
  return next ? 'next' : legacy ? 'legacy' : 'none';
}

export function mediaFailure(): string {
  return missing;
}

export function getCachedVideos(): VideoItem[] {
  return cache;
}

export async function ensureVideoPermission(): Promise<boolean> {
  if (!loadApi()) {
    return false;
  }
  if (next) {
    const current = await next.getPermissionsAsync(false, ['video']);
    if (current.granted) {
      return true;
    }
    const asked = await next.requestPermissionsAsync(false, ['video']);
    return asked.granted;
  }
  const asked = await legacy!.requestPermissionsAsync();
  return asked.granted;
}

export async function listVideos(): Promise<VideoItem[]> {
  if (!loadApi()) {
    throw new Error(`这个客户端没有媒体库模块。${missing}`);
  }

  if (next) {
    const assets = await new next.Query()
      .eq(next.AssetField.MEDIA_TYPE, next.MediaType.VIDEO)
      .orderBy({ key: next.AssetField.CREATION_TIME, ascending: false })
      .exeForMetadata();

    cache = assets.map((asset: any) => ({
      id: asset.id,
      name: asset.filename ?? 'untitled video',
      duration: asset.duration,
      creationTime: asset.creationTime,
      width: asset.width,
      height: asset.height,
    }));
    return cache;
  }

  const page = await legacy!.getAssetsAsync({ mediaType: 'video', first: 1000 });
  cache = page.assets.map((asset: any) => ({
    id: String(asset.id),
    name: asset.filename ?? 'untitled video',
    duration: asset.duration ?? null,
    creationTime: asset.creationTime ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    uri: asset.uri,
  }));
  return cache;
}

export async function videoUri(id: string): Promise<string> {
  const known = cache.find((item) => item.id === id);
  if (known?.uri) {
    return known.uri;
  }
  if (!loadApi()) {
    throw new Error(`这个客户端没有媒体库模块。${missing}`);
  }
  if (next) {
    return new next.Asset(id).getUri();
  }
  const page = await legacy!.getAssetsAsync({ mediaType: 'video', first: 1000 });
  const found = page.assets.find((asset: any) => String(asset.id) === id);
  if (!found) {
    throw new Error('在媒体库里找不到这个文件');
  }
  return found.uri;
}

export async function listShorts(): Promise<VideoItem[]> {
  const items = cache.length ? cache : await listVideos();
  return items.filter(isShortVideo);
}
