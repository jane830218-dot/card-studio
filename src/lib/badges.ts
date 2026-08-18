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

// 規範：文字字級（上下高度）永遠固定，不會因為字數變多而縮小；
// 字數太多、原本的安全區塞不下時，改成把「色塊底圖」整個往左右拉寬，絕對不裁切文字。
const FIXED_FONT_SIZE = 96;

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
  // 文字安全區（以「原始底圖大小」為基準量出來的）：x/w 用來定位文字左右置中點，
  // 字數太多需要拉寬底圖時，x/w 會跟著拉寬倍率等比例放大；y/h（上下位置）永遠不變。
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
  // 02 爆炸框(緞帶款)：往左 1.5 個字、往上 1 個字，再往下修回半個字元、往右修回 0.5 個字
  "burst-ribbon": {
    assetPath: `${BASE}assets/badges/burst-ribbon.png`,
    naturalW: 453,
    naturalH: 139,
    textBox: { x: 114, y: 21, w: 270, h: 58 },
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

  // 先用固定字級量出文字實際需要多寬，字級本身絕對不縮小。
  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `900 ${FIXED_FONT_SIZE}px 'DFLiHeiBdP', 'Microsoft JhengHei', sans-serif`;
  const textWidth = measureCtx.measureText(text).width;

  const { x, y, w, h } = cfg.textBox;
  const padding = 24; // 文字左右留一點安全間距，不要貼齊安全區邊界
  const neededWidth = textWidth + padding;

  // 安全區塞得下就維持原尺寸；塞不下時，整張底圖只往左右等比例拉寬（不拉高），
  // 拉寬倍率 = 需要的寬度 / 原本安全區寬度，這樣文字永遠不會被裁切。
  const widenScale = Math.max(1, neededWidth / w);
  const canvasW = Math.ceil(cfg.naturalW * widenScale);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = cfg.naturalH; // 高度永遠不變
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvasW, cfg.naturalH);

  // 安全區的 x/w 跟著拉寬倍率等比例放大，y/h（上下位置與高度）維持設計時的原值不動。
  const cx = (x + w / 2) * widenScale;
  const cy = y + h / 2;
  // 邊框（stroke）固定 5px，對齊你提供的規範
  drawCenteredText(ctx, text, cx, cy, FIXED_FONT_SIZE, cfg.textColor, cfg.textStroke, 5);
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
