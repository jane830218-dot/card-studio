import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Canvas as FabricCanvas, FabricImage } from "fabric";
import { generateBadgeImage, regenerateBadgeImage, type BadgeShape } from "../lib/badges";
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

    // 色塊（圖片素材款）只允許左右中間的控制點拉寬/壓窄，高度永遠鎖死（字級才不會被拉伸變形），
    // 拖動結束後（放開滑鼠）重新畫一張兩端圓弧不失真的圖換上去，取代 Fabric 原生的整張圖等比例拉伸。
    const handleModified = (e: any) => {
      const target = e.target;
      if (!target || !target.__badgeShape) return;
      const heightScale = target.__badgeHeightScale as number;
      // scaleX 沒有偏離「高度換算出來的固定縮放比例」，代表這次只是移動/旋轉，不是拉寬，不用重畫
      if (Math.abs(target.scaleX - heightScale) < 0.005) return;

      const displayWidth = target.width * target.scaleX; // 目前畫面上的實際寬度（960 座標系）
      const targetNaturalW = displayWidth / heightScale; // 換算回底圖原始大小基準的目標寬度
      // 記住拖曳結束當下的 left/top：setSrc 換圖是非同步的，等圖片載入完成這段期間
      // 物件的 left 可能會被 Fabric 內部處理過程動一下，所以換完圖之後要把位置釘回原地，
      // 不然使用者拖右邊的控制點放寬，結果變成整個色塊被移位。
      const leftBeforeRegen = target.left;
      const topBeforeRegen = target.top;
      regenerateBadgeImage(target.__badgeShape as BadgeShape, target.__badgeText as string, targetNaturalW).then(
        ({ dataUrl, canvasW, naturalH }) => {
          target.setSrc(dataUrl).then(() => {
            target.set({
              left: leftBeforeRegen,
              top: topBeforeRegen,
              width: canvasW,
              height: naturalH,
              scaleX: heightScale,
              scaleY: heightScale,
            });
            fc.requestRenderAll();
          });
        }
      );
    };
    fc.on("object:modified", handleModified);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      fc.off("object:modified", handleModified);
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
        // 預設置中公式：字數太多時 badges.ts 會把底圖拉得比整個畫布（960px）還寬，
        // 這種情況「(畫布寬 - 色塊寬) / 2」會算出負數，色塊（含左邊圓弧、文字開頭）
        // 就會被推到畫布外面看不到，變成畫面上只看到中間平的那段，圓弧像是不見了。
        // 所以正常情況維持置中，太寬時改成貼著左邊留一點邊界，至少左邊圓弧跟文字開頭看得到，
        // 使用者還是可以再自己拖曳調整位置。
        const margin = 16;
        const defaultLeft = Math.max(margin, (PREVIEW_W - targetW) / 2);
        img.set({
          // Fabric 這個版本圖片物件預設 originX/originY 是 "center"（左上角座標系不是預設值了），
          // 但下面這行「置中公式」跟票單匯入指定的 opts.left/top 都是照「左上角」邏輯算的，
          // 沒有明講改成左上角基準的話，色塊實際會用「中心點」去套這個座標，整個往左上偏掉、
          // 甚至可能跑到畫布外面看不到。明講成左上角基準，才會跟公式/opts 想要的位置一致。
          originX: "left",
          originY: "top",
          left: opts?.left ?? defaultLeft,
          top: opts?.top ?? (PREVIEW_H - targetH) / 2,
          scaleX: scale,
          scaleY: scale,
        });
        // 記住這個色塊是哪一款、文字是什麼、高度縮放比例是多少（要永遠鎖住），
        // 縮放結束時（object:modified）才有辦法重新畫圖、保留兩端圓弧不失真。
        (img as any).__badgeShape = shape;
        (img as any).__badgeText = text;
        (img as any).__badgeHeightScale = scale;
        // 只留左右中間的控制點可以拖（拉寬/壓窄），上下、四個角都關掉，
        // 這樣高度（字級）不會被使用者不小心拖變形，旋轉控制點照常保留。
        img.setControlsVisibility({
          mt: false,
          mb: false,
          tl: false,
          tr: false,
          bl: false,
          br: false,
          ml: true,
          mr: true,
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
