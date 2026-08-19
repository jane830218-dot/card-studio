import { useRef } from "react";
import CardCanvas, { type CardCanvasHandle } from "../components/CardCanvas";
import TemplateGrid from "../components/TemplateGrid";
import FieldsPanel from "../components/FieldsPanel";
import PhotoUpload from "../components/PhotoUpload";
import LayerList from "../components/LayerList";
import SaveLoadPanel from "../components/SaveLoadPanel";
import TicketImportPanel from "../components/TicketImportPanel";
import DecorationLayer, { type DecorationLayerHandle } from "../components/DecorationLayer";
import DecorationPanel from "../components/DecorationPanel";
import { useEditorStore } from "../store/editorStore";

export default function Editor() {
  const canvasRef = useRef<CardCanvasHandle>(null);
  const decorationRef = useRef<DecorationLayerHandle>(null);
  const showSafeFrame = useEditorStore((s) => s.showSafeFrame);
  const toggleSafeFrame = useEditorStore((s) => s.toggleSafeFrame);

  // 合併輸出：先畫版型本身（跟原本 exportPNG 一樣的規則：透明底，跳過白底與照片），
  // 再把「裝飾色塊」那層 Fabric 畫布疊上去，最後合成一張圖再觸發下載。
  const handleExport = () => {
    const tpl = useEditorStore.getState().activeTemplateId;
    const exportCanvas = canvasRef.current?.renderExportCanvas();
    if (!exportCanvas) return;

    const decorationCanvas = decorationRef.current?.getFabricCanvas();
    const exportCtx = exportCanvas.getContext("2d");

    const finishDownload = () => {
      const a = document.createElement("a");
      a.href = exportCanvas.toDataURL("image/png");
      a.download = `${tpl}-${Date.now()}.png`;
      a.click();
    };

    if (!decorationCanvas || !exportCtx || decorationCanvas.getObjects().length === 0) {
      finishDownload();
      return;
    }

    // 匯出前先取消選取＋強制重繪一次：如果有色塊還在被選取（有控制手把）、
    // 或畫布還沒重繪完就馬上匯出，toDataURL 抓到的畫面可能不完整，色塊看起來就像消失了。
    decorationCanvas.discardActiveObject();
    decorationCanvas.renderAll();

    // 色塊層預覽是 960×540，輸出圖是 1920×1080，用 multiplier: 2 讓色塊也一起放大兩倍匯出
    const decorationDataUrl = decorationCanvas.toDataURL({ format: "png", multiplier: 2, quality: 1 } as any);
    const img = new Image();
    img.onload = () => {
      exportCtx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
      finishDownload();
    };
    // 萬一色塊層轉出來的圖片載入失敗（理論上不會，但避免整個下載卡住沒反應），
    // 還是讓版型本身正常下載，總比什麼都沒有好。
    img.onerror = () => {
      console.error("裝飾色塊圖層合成失敗，僅輸出版型本身");
      finishDownload();
    };
    img.src = decorationDataUrl;
  };

  return (
    <div id="app">
      <div className="topbar">
        <span className="title">📇 圖卡自動化系統</span>
        <span className="note">字級／顏色依實測 PSD 數據校正；輸出為 1920×1080 透明底 PNG</span>
      </div>
      <div className="layout">
        <div className="panel">
          <TicketImportPanel decorationRef={decorationRef} />
          <TemplateGrid />
          <FieldsPanel />
          <PhotoUpload />
        </div>
        <CardCanvas ref={canvasRef}>
          <DecorationLayer ref={decorationRef} />
        </CardCanvas>
        <div className="panel right">
          <LayerList />
          <DecorationPanel decorationRef={decorationRef} />
          <div className="section-title" style={{ marginTop: 20 }}>
            檢視
          </div>
          <label className="field-label checkbox-label">
            <input type="checkbox" checked={showSafeFrame} onChange={toggleSafeFrame} />
            顯示安全框輔助線（僅預覽用，不會輸出）
          </label>
          <div className="section-title" style={{ marginTop: 20 }}>
            輸出
          </div>
          <button className="btn primary" onClick={handleExport}>
            ⬇ 下載透明底 PNG（含裝飾色塊）
          </button>
          <SaveLoadPanel />
        </div>
      </div>
    </div>
  );
}
