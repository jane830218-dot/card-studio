import { TEMPLATES } from "../templates/templates";
import { BASE_IMAGE_PATHS } from "../templates/assets";
import { useEditorStore } from "../store/editorStore";

export default function TemplateGrid() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const setTemplate = useEditorStore((s) => s.setTemplate);

  return (
    <div>
      <div className="section-title">版型庫（{TEMPLATES.length} 套固定版型）</div>
      <div className="template-grid">
        {TEMPLATES.map((t) => (
          <div
            key={t.id}
            className={"template-card" + (t.id === activeTemplateId ? " active" : "")}
            onClick={() => setTemplate(t.id)}
          >
            <img src={BASE_IMAGE_PATHS[t.thumbImg]} alt={t.name} />
            <div className="label">{t.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
