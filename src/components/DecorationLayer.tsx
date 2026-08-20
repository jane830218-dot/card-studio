import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { generateBadgeImage, BADGE_DEFAULT_PLACEMENT, type BadgeShape } from "../lib/badges";
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
        // 有 PSD 實際擺放參考的款式（見 badges.ts 的 BADGE_DEFAULT_PLACEMENT）用量出來的
        // 高度當預設值，其餘款式（PSD 裡還沒有實際擺放的參考圖層可以量）維持原本固定
        // 90px 高、畫布置中的預設值。
        const placement = BADGE_DEFAULT_PLACEMENT[shape];
        const targetH = placement?.height ?? 90;
        const scale = targetH / (img.height || targetH);
        const targetW = (img.width || 0) * scale;

        let defaultLeft: number;
        let defaultTop: number;
        if (placement) {
          // 預設用「紅色人物框02.psd」裡實際擺放的中心點反推左上角（見 badges.ts 說明），
          // 不管文字多寡改變了色塊寬度，視覺中心都精準對在 PSD 量出來的位置上，
          // 不用再像以前一樣每次都要自己從畫布正中央拖過去。
          defaultLeft = placement.centerX - targetW / 2;
          defaultTop = placement.centerY - targetH / 2;
        } else {
          // 這份 PSD 裡還沒有實際擺放的參考圖層可以量，維持原本「畫布置中」的預設邏輯。
          // 字數太多時 badges.ts 會把底圖拉得比整個畫布（960px）還寬，這種情況
          // 「(畫布寬 - 色塊寬) / 2」會算出負數，色塊（含左邊圓弧、文字開頭）就會被推到
          // 畫布外面看不到，變成畫面上只看到中間平的那段，圓弧像是不見了。所以正常情況
          // 維持置中，太寬時改成貼著左邊留一點邊界，至少左邊圓弧跟文字開頭看得到，
          // 使用者還是可以再自己拖曳調整位置。
          const margin = 16;
          defaultLeft = Math.max(margin, (PREVIEW_W - targetW) / 2);
          defaultTop = (PREVIEW_H - targetH) / 2;
        }
        img.set({
          // Fabric 這個版本圖片物件預設 originX/originY 是 "center"（左上角座標系不是預設值了），
          // 但下面這行「置中公式」跟票單匯入指定的 opts.left/top 都是照「左上角」邏輯算的，
          // 沒有明講改成左上角基準的話，色塊實際會用「中心點」去套這個座標，整個往左上偏掉、
          // 甚至可能跑到畫布外面看不到。明講成左上角基準，才會跟公式/opts 想要的位置一致。
          originX: "left",
          originY: "top",
          left: opts?.left ?? defaultLeft,
          top: opts?.top ?? defaultTop,
          scaleX: scale,
          scaleY: scale,
        });
        // 縮放固定「等比例」：只留四個角的控制點可以拖，上下左右中間那四個關掉
        // （不然拖那些會單獨拉寬或拉高、破壞比例）。Fabric 預設拖角落控制點就是
        // 等比例縮放（除非按住 shift），這樣整個色塊（含文字、圓角）會一起放大縮小，
        // 不會變形。旋轉控制點照常保留。
        img.setControlsVisibility({
          mt: false,
          mb: false,
          ml: false,
          mr: false,
          tl: true,
          tr: true,
          bl: true,
          br: true,
          mtr: true,
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
