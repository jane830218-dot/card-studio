import { useState, type RefObject } from "react";
import type { DecorationLayerHandle } from "./DecorationLayer";
import { BADGE_COLOR_PRESETS, BADGE_SHAPE_LABELS, COLORABLE_SHAPES, type BadgeShape } from "../lib/badges";

interface Props {
  decorationRef: RefObject<DecorationLayerHandle | null>;
}

export default function DecorationPanel({ decorationRef }: Props) {
  const [shape, setShape] = useState<BadgeShape>("rounded");
  const [text, setText] = useState("");
  const [color, setColor] = useState(BADGE_COLOR_PRESETS[0].color);
  const showColorPicker = COLORABLE_SHAPES.includes(shape);

  const handleAdd = () => {
    decorationRef.current?.addBadge(shape, text.trim() || "文字", color);
  };

  return (
    <div>
      <div className="section-title">裝飾色塊</div>
      <div className="hint" style={{ marginBottom: 8 }}>
        圓角框／爆炸框／郵票框是純畫出來的，底色可以自己選；爆炸框(橫幅款)／(緞帶款)是用你提供的圖案，顏色已經固定在圖裡。生成後都可以直接在畫布上拖曳移動／拉角縮放／旋轉，位置不固定沒關係，加好之後自己調整就好。
      </div>

      <div className="badge-shape-buttons">
        {(Object.keys(BADGE_SHAPE_LABELS) as BadgeShape[]).map((s) => (
          <button
            key={s}
            className={"btn" + (shape === s ? " active" : "")}
            onClick={() => setShape(s)}
          >
            {BADGE_SHAPE_LABELS[s]}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="色塊文字，例如：不來就辭總召!"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {showColorPicker && (
        <div className="badge-color-swatches">
          {BADGE_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.color}
              className={"badge-color-swatch" + (color === preset.color ? " active" : "")}
              style={{ background: preset.color }}
              title={preset.label}
              onClick={() => setColor(preset.color)}
            />
          ))}
        </div>
      )}

      <button className="btn primary" onClick={handleAdd} style={{ width: "100%", justifyContent: "center" }}>
        ＋ 新增色塊到畫布
      </button>
      <button
        className="btn"
        style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
        onClick={() => decorationRef.current?.clearAll()}
      >
        清空所有色塊
      </button>
    </div>
  );
}
