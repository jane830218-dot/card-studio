// 「裝飾色塊」畫圖工具 —— 目前只保留你提供的兩款現成 PNG 素材（爆炸框橫幅款／緞帶款），
// 文字疊在圖片上的安全區域內，字型統一用「華康儷粗黑(P)」（DFLiHeiBdP）。
// 之前自己畫的圓角框／爆炸框／郵票框（純向量款）已移除，之後文字規範會另外再調整。
//
// 每個函式回傳一張透明背景的 PNG dataURL，交給 DecorationLayer 當成一個可自由拖曳/縮放/旋轉的圖層加到畫布上。

export type BadgeShape = "burst-h" | "burst-ribbon" | "title-badge-01" | "title-badge-02" | "title-badge-03";

export const BADGE_SHAPE_LABELS: Record<BadgeShape, string> = {
  "burst-h": "爆炸框(橫幅款)",
  "burst-ribbon": "爆炸框(緞帶款)",
  "title-badge-01": "主標色塊字(黃底)",
  "title-badge-02": "主標色塊字(紅底)",
  "title-badge-03": "主標色塊字(白底)",
};

// 目前兩款都是現成 PNG 素材，顏色已經固定在圖裡，沒有可自訂底色的形狀。
export const COLORABLE_SHAPES: BadgeShape[] = [];

// 規範：文字字級（上下高度）永遠固定，不會因為字數變多而縮小；
// 字數太多、原本的安全區塞不下時，改成把「色塊底圖」整個往左右拉寬，絕對不裁切文字。
// 每一款的字級都是直接從 PSD 量出來的（用我們實際的字型 DFLiHeiBdP 900 反推寬度去對 PSD 文字框的寬度），
// 定義在下面各自的 ImageBadgeConfig.fontSize，不再是單一共用常數。

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
  strokeWidth: number;
  fontSize: number;
  // 圓角/圓弧「端蓋」寬度（以原始底圖大小為基準）：拉寬底圖時，左右各留這個寬度的區塊
  // 原封不動複製（不拉伸），只拉伸中間那段，這樣不管拉多寬，兩端的圓弧都不會變形。
  // 純長方形（沒有圓弧）或不規則爆炸框形狀就不設定，維持整張圖等比例拉伸的舊行為。
  capW?: number;
}

const BASE = import.meta.env.BASE_URL;

const IMAGE_BADGES: Record<BadgeShape, ImageBadgeConfig> = {
  // 01 爆炸框(橫幅款)：PSD 裡「爆炸字01」群組跟這張圖大小完全一致（476×137），
  // 文字框直接量 PSD 座標換算：x=64, y=37, w=356, h=57
  "burst-h": {
    assetPath: `${BASE}assets/badges/burst-h.png`,
    naturalW: 476,
    naturalH: 137,
    textBox: { x: 64, y: 37, w: 356, h: 57 },
    textColor: "#ffffff",
    textStroke: "#ac0701",
    strokeWidth: 5,
    fontSize: 59,
  },
  // 02 爆炸框(緞帶款)：PSD 裡「爆炸字02」群組是 455×143，跟這張圖的 453×139 差一點點，
  // 文字框座標照比例縮放過（x=84, y=25, w=354, h=55）
  "burst-ribbon": {
    assetPath: `${BASE}assets/badges/burst-ribbon.png`,
    naturalW: 453,
    naturalH: 139,
    textBox: { x: 84, y: 25, w: 354, h: 55 },
    textColor: "#ffffff",
    textStroke: "#ac0701",
    strokeWidth: 5,
    fontSize: 59,
  },
  // 03/04/05 主標色塊字：放在主標上方的色塊字，跟裝飾色塊一樣手動加到畫布上、自己拖到主標上面。
  // 素材是你「裝飾色塊.psd」裡「主標上色塊字01/02/03」三款，都是從 PSD 原圖去背裁切出來的，
  // 文字框/字級/邊框全部直接量 PSD：01、02 是同一個圓角色塊（564×94），只差底色跟位置；
  // 03 是白色半透明矩形（719×99）。字級一樣用我們的字型反推寬度去對 PSD 文字框寬度
  // （01/02："警匪飛車追逐" 6字，PSD寬386，64px量出來384，幾乎一致；
  //  03："颱風外圍環流攪局" 8字，PSD寬592，74px量出來592，完全一致）。
  "title-badge-01": {
    assetPath: `${BASE}assets/badges/title-badge-01.png`,
    naturalW: 564,
    naturalH: 94,
    textBox: { x: 90, y: 14, w: 386, h: 62 },
    textColor: "#000000",
    textStroke: "#fff002",
    strokeWidth: 3,
    fontSize: 64,
    // 兩端是完整的圓弧（實測整圈圓角，半徑＝高度的一半＝47px），拉寬時要保留
    capW: 47,
  },
  "title-badge-02": {
    assetPath: `${BASE}assets/badges/title-badge-02.png`,
    naturalW: 564,
    naturalH: 94,
    textBox: { x: 90, y: 14, w: 386, h: 62 },
    textColor: "#ffffff",
    textStroke: "#fff002",
    strokeWidth: 3,
    fontSize: 64,
    capW: 47,
  },
  "title-badge-03": {
    assetPath: `${BASE}assets/badges/title-badge-03.png`,
    naturalW: 719,
    naturalH: 99,
    textBox: { x: 105, y: 15, w: 592, h: 69 },
    textColor: "#000000",
    textStroke: "#ffffff",
    strokeWidth: 4,
    fontSize: 74,
    // 這款本身是直角矩形，沒有圓弧要保留，不設定 capW（整張等比例拉伸即可）
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

// 把底圖畫到目標寬度 targetW：如果有設定 capW（兩端圓弧寬度），左右兩端各裁一塊「原封不動」貼上去，
// 中間那一段才拉伸／壓縮，這樣不管拉多寬，兩端的圓弧形狀都不會被拉變形；
// 沒有設定 capW（例如爆炸框的不規則外框、或本身就是直角矩形）就維持整張圖等比例縮放的舊行為。
function drawCapPreservingStretch(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  naturalW: number,
  naturalH: number,
  targetW: number,
  capW: number | undefined
) {
  const cap = capW ? Math.min(capW, Math.floor(naturalW / 2)) : 0;
  if (cap <= 0) {
    ctx.drawImage(img, 0, 0, targetW, naturalH);
    return;
  }
  const midSrcW = naturalW - cap * 2;
  const midDstW = Math.max(0, targetW - cap * 2);
  // 左端圓弧：原尺寸複製，完全不拉伸
  ctx.drawImage(img, 0, 0, cap, naturalH, 0, 0, cap, naturalH);
  // 中間直段：只有這裡跟著拉寬/壓窄
  if (midSrcW > 0 && midDstW > 0) {
    ctx.drawImage(img, cap, 0, midSrcW, naturalH, cap, 0, midDstW, naturalH);
  }
  // 右端圓弧：原尺寸複製，完全不拉伸
  ctx.drawImage(img, naturalW - cap, 0, cap, naturalH, targetW - cap, 0, cap, naturalH);
}

// 核心繪製：可以指定「至少要多寬」（forceMinW，通常來自使用者手動拖曳想要的寬度），
// 實際寬度＝max(容納文字所需的寬度, forceMinW)，這樣使用者可以自由把色塊拖寬（留白變多），
// 但沒辦法拖到比文字還窄、把字擠爆或裁到。
async function drawImageBadge(
  shape: BadgeShape,
  text: string,
  cfg: ImageBadgeConfig,
  forceMinW?: number
): Promise<{ dataUrl: string; canvasW: number; naturalH: number }> {
  const img = await loadBadgeImage(shape, cfg);

  // 先用固定字級量出文字實際需要多寬，字級本身絕對不縮小。
  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `900 ${cfg.fontSize}px 'DFLiHeiBdP', 'Microsoft JhengHei', sans-serif`;
  const textWidth = measureCtx.measureText(text).width;

  const { x, y, w, h } = cfg.textBox;
  const padding = 24; // 文字左右留一點安全間距，不要貼齊安全區邊界
  const neededWidth = textWidth + padding;

  // 安全區塞得下就維持原尺寸；塞不下時，整張底圖只往左右拉寬（不拉高），
  // 拉寬倍率 = 需要的寬度 / 原本安全區寬度，這樣文字永遠不會被裁切。
  // 使用者手動拖曳指定的寬度（forceMinW）可以再更寬，但不能比文字所需的寬度窄。
  const textWidenScale = Math.max(1, neededWidth / w);
  const textMinCanvasW = Math.ceil(cfg.naturalW * textWidenScale);
  const canvasW = Math.max(textMinCanvasW, Math.ceil(forceMinW ?? 0));
  const widenScale = canvasW / cfg.naturalW;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = cfg.naturalH; // 高度永遠不變
  const ctx = canvas.getContext("2d")!;
  drawCapPreservingStretch(ctx, img, cfg.naturalW, cfg.naturalH, canvasW, cfg.capW);

  // 文字安全區的 x/w 跟著拉寬倍率等比例放大，y/h（上下位置與高度）維持設計時的原值不動。
  const cx = (x + w / 2) * widenScale;
  const cy = y + h / 2;
  drawCenteredText(ctx, text, cx, cy, cfg.fontSize, cfg.textColor, cfg.textStroke, cfg.strokeWidth);
  return { dataUrl: canvas.toDataURL("image/png"), canvasW, naturalH: cfg.naturalH };
}

export async function generateBadgeImage(shape: BadgeShape, text: string): Promise<string> {
  const imageCfg = IMAGE_BADGES[shape];
  const { dataUrl } = await drawImageBadge(shape, text || "文字", imageCfg);
  return dataUrl;
}

// 給「畫布上手動拖曳縮放」用：使用者把色塊拖到某個寬度，重新畫一張兩端圓弧不失真的圖。
// targetNaturalW 是「以底圖原始大小為基準」換算出來的目標寬度（呼叫端自己用高度縮放比例反推）。
export async function regenerateBadgeImage(
  shape: BadgeShape,
  text: string,
  targetNaturalW: number
): Promise<{ dataUrl: string; canvasW: number; naturalH: number }> {
  const imageCfg = IMAGE_BADGES[shape];
  return drawImageBadge(shape, text || "文字", imageCfg, targetNaturalW);
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
