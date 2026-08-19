// 繪圖工具函式 —— 逐行對應 card-editor-demo-v5_22.html 裡驗證過的邏輯，
// 刻意不做「看起來更乾淨」的改寫，避免不小心改掉已經跟 PSD 校正過的行為。
import type { ColorSegment, DrawTextOpts } from "./types";

export function drawStrokedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  yBaseline: number,
  opts: DrawTextOpts
) {
  const {
    font,
    fill,
    stroke,
    strokeWidth = 0,
    align = "left",
    letterSpacing = 0,
    maxWidth = null,
    hScale = 1,
    vScale = 1,
    dropShadow = null,
  } = opts;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  (ctx as any).letterSpacing = letterSpacing ? letterSpacing + "px" : "0px";
  let overflowScale = 1;
  if (maxWidth) {
    const w = ctx.measureText(text).width * hScale;
    if (w > maxWidth) overflowScale = maxWidth / w;
  }
  const finalHScale = hScale * overflowScale;
  ctx.save();
  if (finalHScale !== 1 || vScale !== 1) {
    ctx.translate(x, yBaseline);
    ctx.scale(finalHScale, vScale);
    ctx.translate(-x, -yBaseline);
  }
  if (dropShadow) {
    ctx.shadowColor = dropShadow.color;
    ctx.shadowBlur = dropShadow.blur;
    ctx.shadowOffsetX = dropShadow.offsetX;
    ctx.shadowOffsetY = dropShadow.offsetY;
  }
  if (stroke && strokeWidth > 0) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    // 字太多觸發左右壓縮（finalHScale < 1）時，lineWidth 是在「壓縮後」的座標系裡生效，
    // 邊框在左右方向會被跟著壓扁，壓到看起來像「邊不見了」。這裡先除以 finalHScale
    // 補回去，讓邊框壓縮後的實際寬度還是維持原本設定的粗細。
    ctx.lineWidth = strokeWidth / finalHScale;
    ctx.strokeText(text, x, yBaseline);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillText(text, x, yBaseline);
  }
  ctx.restore();
  (ctx as any).letterSpacing = "0px";
}

export function measureSingleRenderedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  letterSpacing: number,
  hScale: number,
  maxWidth: number | null
) {
  ctx.font = font;
  (ctx as any).letterSpacing = letterSpacing ? letterSpacing + "px" : "0px";
  const natural = ctx.measureText(text).width * (hScale || 1);
  (ctx as any).letterSpacing = "0px";
  if (maxWidth && natural > maxWidth) return maxWidth;
  return natural;
}

export function parseColorMarkup(
  text: string | undefined,
  baseColor: string,
  accentColor: string
): ColorSegment[] {
  const segments: ColorSegment[] = [];
  const re = /\(([^()]*)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const src = text || "";
  while ((match = re.exec(src)) !== null) {
    if (match.index > lastIndex) segments.push({ text: src.slice(lastIndex, match.index), fill: baseColor });
    segments.push({ text: match[1], fill: accentColor });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < src.length) segments.push({ text: src.slice(lastIndex), fill: baseColor });
  if (segments.length === 0) segments.push({ text: "", fill: baseColor });
  return segments;
}

export function measureRenderedWidth(
  ctx: CanvasRenderingContext2D,
  segments: ColorSegment[],
  font: string,
  letterSpacing: number,
  maxWidth: number | null
) {
  ctx.font = font;
  (ctx as any).letterSpacing = letterSpacing ? letterSpacing + "px" : "0px";
  const total = segments.reduce((sum, s) => sum + ctx.measureText(s.text).width, 0);
  (ctx as any).letterSpacing = "0px";
  if (maxWidth && total > maxWidth) return maxWidth;
  return total;
}

export function drawStrokedTextSegments(
  ctx: CanvasRenderingContext2D,
  segments: ColorSegment[],
  x: number,
  yBaseline: number,
  opts: DrawTextOpts
) {
  const {
    font,
    stroke,
    strokeWidth = 0,
    align = "left",
    letterSpacing = 0,
    maxWidth = null,
    hScale = 1,
    vScale = 1,
    dropShadow = null,
  } = opts;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  (ctx as any).letterSpacing = letterSpacing ? letterSpacing + "px" : "0px";
  const widths = segments.map((s) => ctx.measureText(s.text).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let overflowScale = 1;
  if (maxWidth) {
    const w = total * hScale;
    if (w > maxWidth) overflowScale = maxWidth / w;
  }
  const finalHScale = hScale * overflowScale;
  let startX = x;
  if (align === "center") startX = x - total / 2;
  else if (align === "right") startX = x - total;
  ctx.save();
  if (finalHScale !== 1 || vScale !== 1) {
    ctx.translate(x, yBaseline);
    ctx.scale(finalHScale, vScale);
    ctx.translate(-x, -yBaseline);
  }
  if (dropShadow) {
    ctx.shadowColor = dropShadow.color;
    ctx.shadowBlur = dropShadow.blur;
    ctx.shadowOffsetX = dropShadow.offsetX;
    ctx.shadowOffsetY = dropShadow.offsetY;
  }
  if (stroke && strokeWidth > 0) {
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = stroke;
    // 同上：壓縮觸發時先除以 finalHScale 補回邊框粗細，避免邊框被壓到快消失。
    ctx.lineWidth = strokeWidth / finalHScale;
    let cx = startX;
    segments.forEach((s, i) => {
      ctx.strokeText(s.text, cx, yBaseline);
      cx += widths[i];
    });
  }
  let cx = startX;
  segments.forEach((s, i) => {
    ctx.fillStyle = s.fill;
    ctx.fillText(s.text, cx, yBaseline);
    cx += widths[i];
  });
  ctx.restore();
  (ctx as any).letterSpacing = "0px";
}
