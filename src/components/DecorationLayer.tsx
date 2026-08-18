import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { generateBadgeImage, type BadgeShape } from "../lib/badges";
import { PREVIEW_W, PREVIEW_H } from "./CardCanvas";

// 疊在 CardCanvas 上面的透明互動層：裝飾色塊（圓角框／爆炸框／郵票框）都加在這裡，
// 跟版型本身（固定座標、CardCanvas 負責畫）分開管理，色塊可以自由拖曳／縮放／旋轉。
// 做法沿用 PhotoPositioner.tsx 已經驗證過的模式：Fabric.js 畫布 + 最後烘焙成圖。

export interface DecorationLayerHandle {
  addBadge: (shape: BadgeShape, text: string, color: string, opts?: { left?: number; top?: number }) => void;
  clearAll: () => void;
  getFabricCanvas: () => FabricCanvas | null;
}

const DecorationLayer = forwardRef<DecorationLayerHandle>((_props, ref) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<FabricCanvas | null>(null);

  useEffect(() => {
    if (!canvasElRef.current) return;
    // 不設定 backgroundColor，維持預設透明，讓底下 CardCanvas 的版型透出來
    const fc = new FabricCanvas(canvasElRef.current);
    fabricRef.current = fc;

    // 按 Delete / Backspace 刪除選取的色塊（輸入框打字時不觸發，避免誤刪）
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const active = fc.getActiveObject();
      if (active && (e.key === "Delete" || e.key === "Backspace")) {
        fc.remove(active);
        fc.requestRenderAll();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      fc.dispose();
      fabricRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getFabricCanvas: () => fabricRef.current,

    addBadge: (shape, text, _color, opts) => {
      const fc = fabricRef.current;
      if (!fc) return;
      // 圖片素材款要先載入 PNG 才能畫（顏色已固定在圖裡，不需要傳 color），所以用 async 處理
      generateBadgeImage(shape, text).then((dataUrl) =>
        FabricImage.fromURL(dataUrl)
      ).then((img) => {
        // badges.ts 現在字太多時會把底圖「拉寬」，寬度不再固定，
        // 所以這裡改成用固定「高度」換算縮放比例（badges.ts 保證高度永遠不變），
        // 這樣不管底圖被拉多寬，畫布上的文字大小都維持一致，不會因為色塊變寬而縮水。
        const targetH = 90;
        const scale = targetH / (img.height || targetH);
        const targetW = (img.width || 0) * scale;
        img.set({
          left: opts?.left ?? (PREVIEW_W - targetW) / 2,
          top: opts?.top ?? (PREVIEW_H - targetH) / 2,
          scaleX: scale,
          scaleY: scale,
        });
        fc.add(img);
        fc.setActiveObject(img);
        fc.requestRenderAll();
      });
    },

    clearAll: () => {
      const fc = fabricRef.current;
      if (!fc) return;
      fc.clear();
      fc.requestRenderAll();
    },
  }));

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: PREVIEW_W, height: PREVIEW_H }}>
      <canvas ref={canvasElRef} width={PREVIEW_W} height={PREVIEW_H} />
    </div>
  );
});

DecorationLayer.displayName = "DecorationLayer";
export default DecorationLayer;
