import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editorStore";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { deleteCard, listCards, saveCard, type SavedCardRow } from "../lib/cardsApi";

export default function SaveLoadPanel() {
  const activeTemplateId = useEditorStore((s) => s.activeTemplateId);
  const fieldValues = useEditorStore((s) => s.fieldValues);
  const loadCard = useEditorStore((s) => s.loadCard);

  const [name, setName] = useState("");
  const [cards, setCards] = useState<SavedCardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    if (!isSupabaseConfigured) return;
    listCards()
      .then(setCards)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="hint" style={{ marginTop: 8 }}>
        尚未設定 Supabase（缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 環境變數），
        目前無法儲存／讀取雲端草稿，其他功能不受影響。
      </div>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("請先輸入名稱");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveCard(name.trim(), activeTemplateId, fieldValues);
      setName("");
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteCard(id);
      refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 8 }}>
      <label className="field-label">儲存目前草稿</label>
      <input
        type="text"
        placeholder="草稿名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn" disabled={busy} onClick={handleSave}>
        💾 儲存到雲端
      </button>
      {error && <div className="hint" style={{ color: "#e05" }}>{error}</div>}
      {cards.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 14 }}>
            已儲存草稿
          </div>
          {cards.map((c) => (
            <div key={c.id} className="layer-row">
              <span onClick={() => loadCard(c.template_id, c.field_values)} style={{ cursor: "pointer" }}>
                {c.name}
              </span>
              <span onClick={() => handleDelete(c.id)} style={{ cursor: "pointer", color: "#999" }}>
                ✕
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
