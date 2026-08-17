import { useEditorStore } from "../store/editorStore";

export default function LayerList() {
  const layers = useEditorStore((s) => s.layers);
  const activeLayerIdx = useEditorStore((s) => s.activeLayerIdx);
  const setActiveLayerIdx = useEditorStore((s) => s.setActiveLayerIdx);

  return (
    <div>
      <div className="section-title">圖層列表</div>
      {layers.map((layer, idx) => (
        <div
          key={idx}
          className={"layer-row" + (idx === activeLayerIdx ? " active" : "")}
          onClick={() => setActiveLayerIdx(idx === activeLayerIdx ? null : idx)}
        >
          {layer.name}
        </div>
      ))}
    </div>
  );
}
