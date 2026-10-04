import { useWindowDimensions } from 'react-native';

// Material 窗口尺寸类：compact <600dp，medium 600–839dp，expanded >=840dp
export function columnsForWidth(width: number): number {
  if (width >= 840) return 3;
  if (width >= 600) return 2;
  return 1;
}

export function useColumns(): number {
  const { width } = useWindowDimensions();
  return columnsForWidth(width);
}

export function isWide(width: number): boolean {
  return width >= 600;
}
