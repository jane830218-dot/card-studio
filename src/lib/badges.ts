// 「裝飾色塊」畫圖工具 —— 目前只保留你提供的兩款現成 PNG 素材（爆炸框橫幅款／緞帶款），
// 文字疊在圖片上的安全區域內，字型統一用「華康儷粗黑(P)」（DFLiHeiBdP）。
// 之前自己畫的圓角框／爆炸框／郵票框（純向量款）已移除，之後文字規範會另外再調整。
//
// 每個函式回傳一張透明背景的 PNG dataURL，交給 DecorationLayer 當成一個可自由拖曳/縮放/旋轉的圖層加到畫布上。

export type BadgeShape = "burst-h" | "burst-ribbon";

export const BADGE_SHAPE_LABELS: Record<BadgeShape, string> = {
  "burst-h": "爆炸框(橫幅款)",
  "burst-ribbon": "爆炸框(緞帶款)",
};

// 目前兩款都是現成 PNG 素材，顏色已經固定在圖裡，沒有可自訂底色的形狀。
export const COLORABLE_SHAPES: BadgeShape[] = [];

// 依文字長度自動縮小字級，避免文字爆出色塊外（跟 templates.ts 裡各版型 autofit 標題的邏輯同概念）
function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, baseSize: number, minSize: number) {
  let size = baseSize;
  while (size > minSize) {
    ctx.font = `900 ${size}px 'DFLiHeiBdP', 'Microsoft JhengHei', sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  fontSize: number,
  fill = "#ffffff",
  stroke = "rgba(0,0,0,0.55)",
  strokeWidth = 6
) {
  ctx.font = `900 ${fontSize}px 'DFLiHeiBdP', 'Microsoft JhengHei', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, cx, cy);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, cy);
}

// ---- 圖片素材款：你自己準備好的去背 PNG（例如手畫或找到的爆炸框圖案）----
// 這裡只需要知道「這張圖多大」「文字要放在圖案裡的哪個安全區域」，不用自己畫形狀，
// 顏色也是圖片本身內建的，不能像向量款那樣自訂底色。
// 之後要加新的圖片素材款式，就是：把去背 PNG 丟進 public/assets/badges/，
// 在下面 IMAGE_BADGES 多加一筆設定（量一下文字安全區的 x/y/w/h）就好，不用碰其他程式碼。
interface ImageBadgeConfig {
  assetPath: string;
  naturalW: number;
  naturalH: number;
  textBox: { x: number; y: number; w: number; h: number };
  textColor: string;
  textStroke: string;
}

const BASE = import.meta.env.BASE_URL;

const IMAGE_BADGES: Record<BadgeShape, ImageBadgeConfig> = {
  // 01 爆炸框(橫幅款)：文字與整張底圖置中對齊（框內置中，不偏靠任一邊）
  "burst-h": {
    assetPath: `${BASE}assets/badges/burst-h.png`,
    naturalW: 476,
    naturalH: 137,
    textBox: { x: 74, y: 40, w: 328, h: 58 },
    textColor: "#ffffff",
    textStroke: "#ac0701",
  },
  // 02 爆炸框(緞帶款)：文字位置依你提供的參考圖，維持既有安全區域，不置中
  "burst-ribbon": {
    assetPath: `${BASE}assets/badges/burst-ribbon.png`,
    naturalW: 453,
    naturalH: 139,
    textBox: { x: 160, y: 46, w: 270, h: 58 },
    textColor: "#ffffff",
    textStroke: "#ac0701",
  },
};

const imageCache: Partial<Record<BadgeShape, HTMLImageElement>> = {};
function loadBadgeImage(shape: BadgeShape, cfg: ImageBadgeConfig): Promise<HTMLImageElement> {
  const cached = imageCache[shape];
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache[shape] = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = cfg.assetPath;
  });
}

async function drawImageBadge(shape: BadgeShape, text: string, cfg: ImageBadgeConfig): Promise<string> {
  const img = await loadBadgeImage(shape, cfg);
  const canvas = document.createElement("canvas");
  canvas.width = cfg.naturalW;
  canvas.height = cfg.naturalH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, cfg.naturalW, cfg.naturalH);
  const { x, y, w, h } = cfg.textBox;
  const fontSize = fitFontSize(ctx, text, w, Math.min(h, 56), 20);
  // 邊框（stroke）固定 5px，對齊你提供的規範
  drawCenteredText(ctx, text, x + w / 2, y + h / 2, fontSize, cfg.textColor, cfg.textStroke, 5);
  return canvas.toDataURL("image/png");
}

export async function generateBadgeImage(shape: BadgeShape, text: string): Promise<string> {
  const imageCfg = IMAGE_BADGES[shape];
  return drawImageBadge(shape, text || "文字", imageCfg);
}

// 幾個跟你版型現有配色一致的常用底色，快速點選用
export const BADGE_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: "紅", color: "#C0000A" },
  { label: "紫", color: "#6131DD" },
  { label: "藍紫", color: "#5C3FFD" },
  { label: "深藍", color: "#171E31" },
  { label: "金黃", color: "#A37B00" },
  { label: "黑", color: "#1a1a1e" },
];
