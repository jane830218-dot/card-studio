import { getTemplateById } from "../templates/templates";
import { useEditorStore } from "../store/editorStore";

export default function FieldsPanel() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const fieldValues = useEditorStore((s) => s.fieldValues);
  const setField = useEditorStore((s) => s.setField);
  const tpl = getTemplateById(activeTemplateId);
  if (!tpl) return null;

  return (
    <div>
      <div className="section-title">內容欄位</div>
      <div className="hint" style={{ marginBottom: 8 }}>
        跟發單習慣一樣，用 <code>()</code> 括起來的文字會變成強調色，例如「本週(重磅)消息公布!」；()
        可放在句子任何位置，括號本身只是標記、實際畫面上不會顯示
      </div>
      {tpl.fields.map((f) => {
        if (f.type === "checkbox") {
          return (
            <label key={f.key} className="field-label checkbox-label">
              <input
                type="checkbox"
                checked={!!fieldValues[f.key]}
                onChange={(e) => setField(f.key, e.target.checked)}
              />
              {f.label}
            </label>
          );
        }
        return (
          <div key={f.key}>
            <label className="field-label">{f.label}</label>
            <textarea
              rows={f.key.includes("title") ? 2 : 1}
              value={(fieldValues[f.key] as string) || ""}
              onChange={(e) => setField(f.key, e.target.value)}
            />
          </div>
        );
      })}
    </div>
  );
}
