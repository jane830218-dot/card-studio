// 「裝飾色塊」畫圖工具 —— 圓角框／爆炸框／郵票框，純用 Canvas 幾何圖形 + 文字畫出來，
// 不是 AI 生圖、不存資料庫，跟 templates.ts 裡版型的畫法是同一套邏輯，只是形狀更單純、
// 而且可以自由指定文字與底色（因為每次工單需要的色塊文字/顏色/位置都不固定，沒辦法寫死）。
//
// 每個函式回傳一張透明背景的 PNG dataURL，尺寸內部固定（BADGE_CANVAS_W/H），
// 交給 DecorationLayer 當成一個可自由拖曳/縮放/旋轉的圖層加到畫布上。

export type BadgeShape = "rounded" | "burst" | "stamp" | "burst-h" | "burst-ribbon";

export const BADGE_SHAPE_LABELS: Record<BadgeShape, string> = {
  rounded: "圓角框",
  burst: "爆炸框",
  stamp: "郵票框",
  "burst-h": "爆炸框(橫幅款)",
  "burst-ribbon": "爆炸框(緞帶款)",
};

// 哪些形狀是「純向量畫的、可以自訂底色」，哪些是「用你提供的現成 PNG 素材、顏色已經固定在圖裡」——
// DecorationPanel 會用這個判斷要不要顯示色盤。
export const COLORABLE_SHAPES: BadgeShape[] = ["rounded", "burst", "stamp"];

const BADGE_CANVAS_W = 640;
const BADGE_CANVAS_H = 280;

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

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- 1. 圓角框：色底 + 白色粗邊框 + 置中文字（例：「傅:軟性抗議」）----
function drawRoundedBadge(ctx: CanvasRenderingContext2D, text: string, color: string) {
  const pad = 40;
  const x = pad, y = pad, w = BADGE_CANVAS_W - pad * 2, h = BADGE_CANVAS_H - pad * 2;
  const r = 24;

  roundedRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();

  const fontSize = fitFontSize(ctx, text, w - 60, 84, 30);
  drawCenteredText(ctx, text, x + w / 2, y + h / 2, fontSize, "#fff6dc", "rgba(0,0,0,0.5)", 5);
}

// ---- 2. 爆炸框：星芒爆炸形狀 + 置中文字（例：「不來就辭總召!」）----
function drawBurstBadge(ctx: CanvasRenderingContext2D, text: string, color: string) {
  const cx = BADGE_CANVAS_W / 2;
  const cy = BADGE_CANVAS_H / 2;
  const spikes = 14;
  const outerR = 150;
  const innerR = 108;

  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * radius * (BADGE_CANVAS_W / BADGE_CANVAS_H > 1 ? 1.7 : 1);
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  const fontSize = fitFontSize(ctx, text, outerR * 2.4, 68, 26);
  drawCenteredText(ctx, text, cx, cy, fontSize, "#fff000", "#000000", 6);
}

// ---- 3. 郵票框：色底 + 白色雙線邊框 + 輕微旋轉的貼紙感 + 置中文字（例：「中元前後恐再漲」）----
function drawStampBadge(ctx: CanvasRenderingContext2D, text: string, color: string) {
  const pad = 46;
  const w = BADGE_CANVAS_W - pad * 2;
  const h = BADGE_CANVAS_H - pad * 2;

  ctx.save();
  ctx.translate(BADGE_CANVAS_W / 2, BADGE_CANVAS_H / 2);
  ctx.rotate((-2.5 * Math.PI) / 180);
  ctx.translate(-BADGE_CANVAS_W / 2, -BADGE_CANVAS_H / 2);

  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 6;

  const x = pad, y = pad;
  roundedRectPath(ctx, x, y, w, h, 10);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  roundedRectPath(ctx, x, y, w, h, 10);
  ctx.stroke();
  const inset = 12;
  ctx.lineWidth = 3;
  roundedRectPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, 6);
  ctx.stroke();

  const fontSize = fitFontSize(ctx, text, w - 70, 64, 26);
  drawCenteredText(ctx, text, x + w / 2, y + h / 2, fontSize, "#ffffff", "rgba(0,0,0,0.4)", 4);

  ctx.restore();
}

const DRAWERS: Partial<Record<BadgeShape, (ctx: CanvasRenderingContext2D, text: string, color: string) => void>> = {
  rounded: drawRoundedBadge,
  burst: drawBurstBadge,
  stamp: drawStampBadge,
};

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

const IMAGE_BADGES: Partial<Record<BadgeShape, ImageBadgeConfig>> = {
  "burst-h": {
    assetPath: `${BASE}assets/badges/burst-h.png`,
    naturalW: 476,
    naturalH: 137,
    textBox: { x: 80, y: 54, w: 328, h: 58 },
    textColor: "#ffffff",
    textStroke: "rgba(0,0,0,0.6)",
  },
  "burst-ribbon": {
    assetPath: `${BASE}assets/badges/burst-ribbon.png`,
    naturalW: 453,
    naturalH: 139,
    textBox: { x: 160, y: 46, w: 270, h: 58 },
    textColor: "#ffffff",
    textStroke: "rgba(0,0,0,0.6)",
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
  drawCenteredText(ctx, text, x + w / 2, y + h / 2, fontSize, cfg.textColor, cfg.textStroke, 4);
  return canvas.toDataURL("image/png");
}

export async function generateBadgeImage(shape: BadgeShape, text: string, color: string): Promise<string> {
  const imageCfg = IMAGE_BADGES[shape];
  if (imageCfg) return drawImageBadge(shape, text || "文字", imageCfg);

  const drawer = DRAWERS[shape];
  const canvas = document.createElement("canvas");
  canvas.width = BADGE_CANVAS_W;
  canvas.height = BADGE_CANVAS_H;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, BADGE_CANVAS_W, BADGE_CANVAS_H);
  drawer?.(ctx, text || "文字", color);
  return canvas.toDataURL("image/png");
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
