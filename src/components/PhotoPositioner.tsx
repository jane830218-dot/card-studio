import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { useEditorStore } from "../store/editorStore";
import { getTemplateById } from "../templates/templates";

// 這個面板不是原本 demo 的一部分，是額外用 Fabric.js 補上的功能：
// demo 上傳照片後只會用寫死的公式自動置中/覆蓋插槽，這裡讓使用者可以自己拖曳／縮放，
// 決定照片要露出哪個部分，滿意後「套用」再烘焙成插槽尺寸的圖，交給 CardCanvas 直接貼上。
// 注意：正式輸出的透明底 PNG 一律不含這張照片（跟 demo 規則一致，照片只是預覽用），
// 這裡純粹是讓編輯時的預覽更準確。
const PANEL_MAX_W = 240;

export default function PhotoPositioner() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const rawUploadedImg = useEditorStore((s) => s.rawUploadedImg);
  const setPositionedOverride = useEditorStore((s) => s.setPositionedOverride);
  const positionedOverride = useEditorStore((s) => s.positionedOverride);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);
  const [dirty, setDirty] = useState(false);

  const tpl = getTemplateById(activeTemplateId);
  const slot = tpl?.imageSlot;

  useEffect(() => {
    if (!slot || !rawUploadedImg || !canvasElRef.current) return;
    const scale = Math.min(PANEL_MAX_W / slot.w, PANEL_MAX_W / slot.h, 1);
    const viewW = slot.w * scale;
    const viewH = slot.h * scale;

    const fc = new FabricCanvas(canvasElRef.current, {
      width: viewW,
      height: viewH,
      backgroundColor: "#000",
    });
    fabricRef.current = fc;

    FabricImage.fromURL(rawUploadedImg.src).then((img) => {
      const coverScale = Math.max(viewW / img.width!, viewH / img.height!);
      img.set({
        left: viewW / 2,
        top: viewH / 2,
        originX: "center",
        originY: "center",
        scaleX: coverScale,
        scaleY: coverScale,
      });
      fc.add(img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
    });

    fc.on("object:moving", () => setDirty(true));
    fc.on("object:scaling", () => setDirty(true));

    return () => {
      fc.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplateId, rawUploadedImg]);

  if (!slot || !rawUploadedImg) return null;

  const apply = () => {
    const fc = fabricRef.current;
    if (!fc) return;
    const scale = slot.w / fc.getWidth();
    const bakeCanvas = document.createElement("canvas");
    bakeCanvas.width = slot.w;
    bakeCanvas.height = slot.h;
    const bctx = bakeCanvas.getContext("2d");
    if (!bctx) return;
    // 用 Fabric 內建的匯出（依畫布尺寸比例放大到插槽的實際像素尺寸），再包成一般 <img>
    // 交給 CardCanvas，讓後續合成流程不用知道 Fabric.js 的存在。
    const dataUrl = fc.toDataURL({ format: "png", multiplier: scale, quality: 1 } as any);
    const img = new Image();
    img.onload = () => setPositionedOverride(img);
    img.src = dataUrl;
    setDirty(false);
  };

  const reset = () => {
    setPositionedOverride(null);
    setDirty(false);
  };

  return (
    <div className="photo-positioner" ref={wrapperRef}>
      <label className="field-label">調整照片位置／縮放（拖曳移動、拉角縮放）</label>
      <div className="photo-positioner-canvas">
        <canvas ref={canvasElRef} />
      </div>
      <div style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={apply} disabled={!dirty && !!positionedOverride}>
          套用此構圖
        </button>
        <button className="btn" onClick={reset}>
          還原自動裁切
        </button>
      </div>
      <div className="hint">套用後畫面預覽會照這個構圖顯示；輸出的透明底 PNG 本來就不含照片，這裡只影響預覽準不準。</div>
    </div>
  );
}
