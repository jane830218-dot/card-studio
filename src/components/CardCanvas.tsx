import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { getTemplateById } from "../templates/templates";
import { loadFonts, preloadAll, safeFrameImage } from "../templates/assets";

export interface CardCanvasHandle {
  exportPNG: () => void;
}

const PREVIEW_W = 960;
const PREVIEW_H = 540;
const EXPORT_W = 1920;
const EXPORT_H = 1080;

const CardCanvas = forwardRef<CardCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const fieldValues = useEditorStore((s) => s.fieldValues);
  const rawUploadedImg = useEditorStore((s) => s.rawUploadedImg);
  const positionedOverride = useEditorStore((s) => s.positionedOverride);
  const activeLayerIdx = useEditorStore((s) => s.activeLayerIdx);
  const setLayers = useEditorStore((s) => s.setLayers);
  const showSafeFrame = useEditorStore((s) => s.showSafeFrame);

  useEffect(() => {
    Promise.all([preloadAll(), loadFonts()]).then(() => setReady(true));
  }, []);

  useEffect(() => {
    if ((document as any).fonts && (document as any).fonts.ready) {
      (document as any).fonts.ready.then(() => setReady((r) => r || true));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tpl = getTemplateById(activeTemplateId);
    if (!tpl) return;
    const builtLayers = tpl.build(fieldValues);
    setLayers(builtLayers);
    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
    builtLayers.forEach((layer, idx) => {
      ctx.save();
      if (layer.isImageSlot) {
        // 有經過 Fabric.js 定位面板調整過的話，直接照使用者調好的裁切/位置貼進插槽，
        // 不再套用 demo 原本針對「未經處理的原始照片」寫死的自動置中/覆蓋公式。
        if (positionedOverride && tpl.imageSlot) {
          const slot = tpl.imageSlot;
          ctx.drawImage(positionedOverride, slot.x, slot.y, slot.w, slot.h);
        } else {
          layer.draw(ctx, rawUploadedImg);
        }
      } else layer.draw(ctx);
      ctx.restore();
      if (idx === activeLayerIdx) {
        ctx.save();
        ctx.strokeStyle = "#4f8cff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(2, 2, PREVIEW_W - 4, PREVIEW_H - 4);
        ctx.restore();
      }
    });

    if (showSafeFrame && safeFrameImage) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(safeFrameImage, 0, 0, PREVIEW_W, PREVIEW_H);
      ctx.restore();
    }
  }, [ready, activeTemplateId, fieldValues, rawUploadedImg, positionedOverride, activeLayerIdx, showSafeFrame]);

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const tpl = getTemplateById(activeTemplateId);
      if (!tpl) return;
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = EXPORT_W;
      exportCanvas.height = EXPORT_H;
      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return;
      exportCtx.scale(EXPORT_W / PREVIEW_W, EXPORT_H / PREVIEW_H);
      const builtLayers = tpl.build(fieldValues);
      builtLayers.forEach((layer) => {
        // 跟原本 demo 的規則一致：輸出一律透明底，跳過白底墊色與人物/情境照片窗口，
        // 只留下真正的圖框素材、文字、icon —— 這些才是要交付去疊到畫面上的東西。
        if (layer.isBgFill || layer.isImageSlot) return;
        exportCtx.save();
        layer.draw(exportCtx);
        exportCtx.restore();
      });
      const a = document.createElement("a");
      a.href = exportCanvas.toDataURL("image/png");
      a.download = `${tpl.id}-${Date.now()}.png`;
      a.click();
    },
  }));

  return (
    <div className="canvas-wrap">
      <div className="canvas-shell">
        <canvas ref={canvasRef} width={PREVIEW_W} height={PREVIEW_H} />
      </div>
      {!ready && <div className="canvas-loading">載入版型素材與字型中…</div>}
    </div>
  );
});

CardCanvas.displayName = "CardCanvas";
export default CardCanvas;
export { PREVIEW_W, PREVIEW_H };
