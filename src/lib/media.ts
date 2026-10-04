import {
  Asset,
  AssetField,
  MediaType,
  Query,
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-media-library';
import { isShortVideo } from './format';

export type VideoItem = {
  id: string;
  name: string;
  duration: number | null;
  creationTime: number | null;
  width: number | null;
  height: number | null;
};

let cache: VideoItem[] = [];

export function getCachedVideos(): VideoItem[] {
  return cache;
}

export async function ensureVideoPermission(): Promise<boolean> {
  const current = await getPermissionsAsync(false, ['video']);
  if (current.granted) {
    return true;
  }
  const asked = await requestPermissionsAsync(false, ['video']);
  return asked.granted;
}

export async function listVideos(): Promise<VideoItem[]> {
  const assets = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.VIDEO)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .exeForMetadata();

  cache = assets.map((asset) => ({
    id: asset.id,
    name: asset.filename ?? 'untitled video',
    duration: asset.duration,
    creationTime: asset.creationTime,
    width: asset.width,
    height: asset.height,
  }));
  return cache;
}

export async function listShorts(): Promise<VideoItem[]> {
  const items = cache.length ? cache : await listVideos();
  return items.filter(isShortVideo);
}

export function videoUri(id: string): Promise<string> {
  return new Asset(id).getUri();
}
