import { useState } from "react";
import { useEditorStore } from "../store/editorStore";

// 貼上工單「說明」欄位的原始文字，自動解析成版型 + 欄位值。
// 支援的區塊標記（跟發單習慣一致）：
//   第一段（通常是「XX色人物框 框N 主題」）→ 用來判斷要套用哪個顏色版型
//   主標=                                  → 標題第一行／第二行（依換行拆兩行）
//   右上小標=                              → 對應 tag 欄位（頂部標籤文字）
//   (SOU:...)                              → 純備註，會被忽略，不會填進任何欄位
//
// 目前只處理紅／紫／藍／綠這四個「緞帶框」版型（因為它們的欄位結構一致：
// tag / title1 / title2）。如果之後要支援「人物框大字」「圓框大字」等其他版型，
// 欄位名稱不同，需要另外擴充下面的 applyToFields()。

const COLOR_TO_TEMPLATE: Record<string, string> = {
  紅: "red-frame",
  紅色: "red-frame",
  紫: "purple-frame",
  紫色: "purple-frame",
  藍: "blue-frame",
  藍色: "blue-frame",
  綠: "green-frame",
  綠色: "green-frame",
};

interface ParsedTicket {
  templateId: string | null;
  colorKeyword: string | null;
  frameNumber: string | null;
  tag: string | null;
  title1: string | null;
  title2: string | null;
  warn: string | null;
  ignoredLines: string[];
}

function parseTicketText(raw: string): ParsedTicket {
  const blocks = raw
    .split(/\n\s*\n/) // 用空白行切成一段一段
    .map((b) => b.trim())
    .filter(Boolean);

  const result: ParsedTicket = {
    templateId: null,
    colorKeyword: null,
    frameNumber: null,
    tag: null,
    title1: null,
    title2: null,
    warn: null,
    ignoredLines: [],
  };

  for (const block of blocks) {
    if (block.startsWith("主標=")) {
      const lines = block
        .replace(/^主標=\s*/, "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      result.title1 = lines[0] ?? null;
      result.title2 = lines[1] ?? null;
      continue;
    }

    if (block.startsWith("右上小標=")) {
      result.tag = block.replace(/^右上小標=\s*/, "").trim();
      continue;
    }

    if (block.startsWith("警語=")) {
      result.warn = block.replace(/^警語=\s*/, "").trim();
      continue;
    }

    // (SOU:...) 純備註，直接跳過不處理
    if (/^\(SOU[:：]/i.test(block)) {
      continue;
    }

    // 還沒抓到顏色/框號時，優先檢查這段是不是「OO色人物框 框N ...」那行
    if (!result.colorKeyword) {
      const colorMatch = block.match(/(紅色?|紫色?|藍色?|綠色?)/);
      const frameMatch = block.match(/框(\d+)/);
      if (colorMatch || frameMatch) {
        if (colorMatch) result.colorKeyword = colorMatch[1];
        if (frameMatch) result.frameNumber = frameMatch[1];
        continue;
      }
    }

    // 其他抓不到規則的段落（例如發單人/手機那行）先留著給人工確認，不自動套用
    result.ignoredLines.push(block);
  }

  if (result.colorKeyword) {
    result.templateId = COLOR_TO_TEMPLATE[result.colorKeyword] ?? null;
  }

  return result;
}

export default function TicketImportPanel() {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ParsedTicket | null>(null);
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const setField = useEditorStore((s) => s.setField);

  const handleParse = () => {
    setPreview(parseTicketText(raw));
  };

  const handleApply = () => {
    if (!preview) return;
    if (preview.templateId) {
      setTemplate(preview.templateId);
    }
    if (preview.tag !== null) setField("tag", preview.tag);
    if (preview.title1 !== null) setField("title1", preview.title1);
    if (preview.title2 !== null) setField("title2", preview.title2);
    if (preview.warn !== null) setField("warn", preview.warn);
  };

  return (
    <div>
      <div className="section-title">貼上工單文字自動生成</div>
      <div className="hint" style={{ marginBottom: 8 }}>
        直接貼上「說明」欄位的完整內容（含 主標= / 右上小標= 等區塊），按「解析」預覽拆解結果，
        確認沒問題再按「套用」寫入版型與欄位。
      </div>
      <textarea
        rows={10}
        placeholder={
          "例：\n藍色人物框 框12七星潭刁車\n\n主標=\n不諳路況(闖七星潭)\n吉普車(陷海灘慘困)\n\n右上小標=\n(擅闖管制區)恐吃罰單"
        }
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button className="btn" onClick={handleParse} disabled={!raw.trim()}>
          解析
        </button>
        <button className="btn primary" onClick={handleApply} disabled={!preview}>
          套用到畫布
        </button>
      </div>

      {preview && (
        <div className="ticket-preview" style={{ marginTop: 12, fontSize: 13 }}>
          <div>
            判斷版型：
            {preview.templateId ? (
              <strong>{preview.templateId}</strong>
            ) : (
              <span style={{ color: "#c0000a" }}>
                無法辨識顏色關鍵字，請確認第一段有寫「紅／紫／藍／綠」
              </span>
            )}
            {preview.frameNumber && <span>（框{preview.frameNumber}，目前僅供參考，尚未對應多款式）</span>}
          </div>
          <div>右上小標：{preview.tag ?? <em>（未偵測到）</em>}</div>
          <div>標題第一行：{preview.title1 ?? <em>（未偵測到）</em>}</div>
          <div>標題第二行：{preview.title2 ?? <em>（未偵測到）</em>}</div>
          {preview.warn !== null && <div>警語：{preview.warn}</div>}
          {preview.ignoredLines.length > 0 && (
            <div style={{ marginTop: 6, color: "#888" }}>
              以下段落未被解析，僅供人工確認：
              {preview.ignoredLines.map((line, i) => (
                <div key={i} style={{ whiteSpace: "pre-wrap" }}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
