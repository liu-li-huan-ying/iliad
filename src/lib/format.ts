const FINISHED_RATIO = 0.97;

export const SHORT_MAX_SECONDS = 180;
export const SHORT_FALLBACK_SECONDS = 60;

export type ShapeHint = {
  width: number | null;
  height: number | null;
  duration: number | null;
};

export function isShortVideo(item: ShapeHint): boolean {
  const duration = item.duration ?? 0;
  if (item.width && item.height) {
    return item.height > item.width && duration <= SHORT_MAX_SECONDS;
  }
  return duration > 0 && duration <= SHORT_FALLBACK_SECONDS;
}

export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function ratioOf(position: number, duration: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, position / duration));
}

export function resumeAt(position: number, duration: number): number {
  if (ratioOf(position, duration) >= FINISHED_RATIO) {
    return 0;
  }
  return Number.isFinite(position) ? Math.max(0, position) : 0;
}
