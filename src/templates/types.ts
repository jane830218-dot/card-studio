// 型別定義 —— 對應原本 HTML demo（card-editor-demo-v5_22.html）裡的資料結構，
// 刻意維持跟 demo 幾乎一樣的欄位命名，方便日後比對兩邊邏輯是否一致。

export interface DropShadowOpts {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface DrawTextOpts {
  font: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  align?: CanvasTextAlign;
  letterSpacing?: number;
  maxWidth?: number | null;
  hScale?: number;
  vScale?: number;
  dropShadow?: DropShadowOpts | null;
}

export interface ColorSegment {
  text: string;
  fill: string;
}

export interface FieldDef {
  key: string;
  label: string;
  default: string | boolean;
  type?: "text" | "checkbox";
}

export interface CardLayer {
  name: string;
  isBgFill?: boolean;
  isImageSlot?: boolean;
  draw: (ctx: CanvasRenderingContext2D, img?: HTMLImageElement | null) => void;
}

export type FieldValues = Record<string, string | boolean>;

export interface TemplateDef {
  id: string;
  name: string;
  thumbImg: string;
  fields: FieldDef[];
  build: (fields: FieldValues) => CardLayer[];
  /** 這個版型的人物/情境圖插槽的建議尺寸與位置，供 Fabric.js 互動定位面板使用 */
  imageSlot?: {
    /** 畫布座標系採用 demo 的半尺寸座標（960x540） */
    x: number;
    y: number;
    w: number;
    h: number;
    fit: "cover" | "contain-bottom";
  };
}
