import { useRef } from "react";
import CardCanvas, { type CardCanvasHandle } from "../components/CardCanvas";
import TemplateGrid from "../components/TemplateGrid";
import FieldsPanel from "../components/FieldsPanel";
import PhotoUpload from "../components/PhotoUpload";
import LayerList from "../components/LayerList";
import SaveLoadPanel from "../components/SaveLoadPanel";
import TicketImportPanel from "../components/TicketImportPanel";
import { useEditorStore } from "../store/editorStore";

export default function Editor() {
  const canvasRef = useRef<CardCanvasHandle>(null);
  const showSafeFrame = useEditorStore((s) => s.showSafeFrame);
  const toggleSafeFrame = useEditorStore((s) => s.toggleSafeFrame);

  return (
    <div id="app">
      <div className="topbar">
        <span className="title">📇 圖卡自動化系統</span>
        <span className="note">字級／顏色依實測 PSD 數據校正；輸出為 1920×1080 透明底 PNG</span>
      </div>
      <div className="layout">
        <div className="panel">
          <TicketImportPanel />
          <TemplateGrid />
          <FieldsPanel />
          <PhotoUpload />
        </div>
        <CardCanvas ref={canvasRef} />
        <div className="panel right">
          <LayerList />
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
          <button className="btn primary" onClick={() => canvasRef.current?.exportPNG()}>
            ⬇ 下載透明底 PNG
          </button>
          <SaveLoadPanel />
        </div>
      </div>
    </div>
  );
}
