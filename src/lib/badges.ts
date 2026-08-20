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

// 量出文字「實際墨色範圍」（actualBoundingBoxLeft/Right），而不是字元標準寬度。
// 全形標點（例如「（」「）」）的字元框本身就內建了不少留白（框寬跟其他全形字一樣，
// 但可見的符號本身很窄、置中在框裡），如果只靠 measureText().width 這種「標準寬度」
// 去計算留白/置中，遇到開頭或結尾是全形括號的文字，就會多出「字元內建留白」+「我們自己
// 設定的留白」兩份，看起來留白比實際想要的還要多一大截。用 actualBoundingBox 量出來的
// 才是「畫面上實際看得到墨色的範圍」，才能量出/置中出真正的留白距離。
function measureInk(ctx: CanvasRenderingContext2D, text: string, fontSize: number) {
  ctx.font = `900 ${fontSize}px 'DFLiHeiBdP', 'Microsoft JhengHei', sans-serif`;
  ctx.textAlign = "left";
  const m = ctx.measureText(text);
  // 這兩個值是相對於「文字起點（x=0，textAlign=left 的錨點）」量出來的墨色左右邊界，
  // inkLeft 可能是正數（墨色比起點更往右，例如開頭是全形括號留白的情況）。
  const inkLeft = -m.actualBoundingBoxLeft;
  const inkRight = m.actualBoundingBoxRight;
  return { inkLeft, inkRight, inkWidth: Math.max(0, inkRight - inkLeft) };
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
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // 用墨色範圍的中點去對齊 cx，而不是用 textAlign=center（那是用標準寬度的中點，
  // 遇到開頭/結尾是全形括號這種「字元框留白不對稱」的文字，中心點會跟看起來的視覺中心對不上）。
  const { inkLeft, inkRight } = measureInk(ctx, text, fontSize);
  const inkCenter = (inkLeft + inkRight) / 2;
  const drawX = cx - inkCenter;
  if (strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, drawX, cy);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, drawX, cy);
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
// 實際寬度＝max(容納文字所需的寬度, 兩端圓弧不會擠在一起的寬度, forceMinW)。
// 使用者可以自由把色塊拖寬或拖窄，但沒辦法拖到比「文字＋留白」還窄、把字擠爆或裁到，
// 也沒辦法拖到比「兩端圓弧加起來」還窄、讓兩端圓弧互相擠壓變形。
async function drawImageBadge(
  shape: BadgeShape,
  text: string,
  cfg: ImageBadgeConfig,
  forceMinW?: number
): Promise<{ dataUrl: string; canvasW: number; naturalH: number }> {
  const img = await loadBadgeImage(shape, cfg);

  // 先用固定字級量出文字「實際墨色寬度」（不是字元標準寬度，理由見 measureInk 註解），
  // 字級本身絕對不縮小。
  const measureCtx = document.createElement("canvas").getContext("2d")!;
  const { inkWidth: textWidth } = measureInk(measureCtx, text, cfg.fontSize);

  const { x, y, w, h } = cfg.textBox;
  // 文字跟左右邊框只留 0.5 個字寬的空間就好，不要像以前一樣留一大片白邊。
  const paddingEachSide = cfg.fontSize * 0.5;
  const neededWidth = textWidth + paddingEachSide * 2;

  let canvasW: number;
  let cx: number;
  if (cfg.capW) {
    // 有端蓋圓弧的款式（例如主標色塊字）：兩端圓弧本身寬度固定、永遠不會被拉伸，
    // 只有中間那段會伸縮。之前的算法是把 PSD 量出來的 textBox x（本身就跟端蓋有一段
    // 設計上的固定間距）也一起乘上拉寬倍率，結果字數一多、拉寬倍率變大時，
    // 這段「跟端蓋的固定間距」也跟著被放大，兩端圓弧到文字之間的留白就會遠遠超過
    // 我們想要的 0.5 字元、而且倍率愈大留白愈誇張。
    // 正確做法：兩端圓弧寬度相等，中間段的正中央＝整張圖的正中央，直接把文字置中在
    // 整張圖正中間，中間段只要能塞下「文字＋左右各 0.5 字元留白」就好，這樣不管拉多寬，
    // 圓弧到文字的留白永遠精準等於 paddingEachSide，不會跟著拉寬倍率一起放大。
    const minCanvasW = cfg.capW * 2 + neededWidth;
    canvasW = Math.max(Math.ceil(minCanvasW), Math.ceil(forceMinW ?? 0));
    cx = canvasW / 2;
  } else {
    // 沒有端蓋（不規則爆炸框外框、或本身就是直角矩形的款式）：沒有「固定寬度端蓋」
    // 這個問題，維持原本整張圖等比例縮放、文字安全區 x/w 跟著等比例移動的算法。
    const textWidenScale = neededWidth / w;
    const textMinCanvasW = Math.ceil(cfg.naturalW * textWidenScale);
    canvasW = Math.max(textMinCanvasW, Math.ceil(forceMinW ?? 0));
    const finalWidenScale = canvasW / cfg.naturalW;
    cx = (x + w / 2) * finalWidenScale;
  }

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = cfg.naturalH; // 高度永遠不變
  const ctx = canvas.getContext("2d")!;
  drawCapPreservingStretch(ctx, img, cfg.naturalW, cfg.naturalH, canvasW, cfg.capW);

  // y/h（上下位置與高度）維持設計時的原值不動，只有水平位置 cx 會依款式用上面兩種算法之一。
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
