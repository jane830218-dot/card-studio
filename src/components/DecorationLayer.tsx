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

    addBadge: (shape, text, color, opts) => {
      const fc = fabricRef.current;
      if (!fc) return;
      // 圖片素材款要先載入 PNG 才能畫，向量款則是立刻算完，所以統一用 async 處理
      generateBadgeImage(shape, text, color).then((dataUrl) =>
        FabricImage.fromURL(dataUrl)
      ).then((img) => {
        const targetW = 300;
        const scale = targetW / (img.width || targetW);
        const targetH = (img.height || 0) * scale;
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
