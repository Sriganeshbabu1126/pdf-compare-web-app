export type ShapeType = 'box' | 'line' | 'arrow' | 'text' | 'cloud';

export interface Annotation {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  text?: string;
  color: string;
}

export interface CompareProject {
  v1DataUrl: string | null;
  v2DataUrl: string | null;
  v1Tinted: string | null;
  v2Tinted: string | null;
  v1FileName?: string | null;
  v2FileName?: string | null;
  v2Offset: { x: number; y: number };
  annotations: Annotation[];
  zoom: number;
}
