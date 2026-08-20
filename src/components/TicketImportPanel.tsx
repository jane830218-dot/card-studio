import { useState, type RefObject } from "react";
import { useEditorStore } from "../store/editorStore";
import type { DecorationLayerHandle } from "./DecorationLayer";
import { BADGE_SHAPE_LABELS, type BadgeShape } from "../lib/badges";

// 貼上工單「說明」欄位的原始文字，自動解析成版型 + 欄位值 + 裝飾色塊。
// 支援的區塊標記（跟發單習慣一致）：
//   第一段（通常是「XX色人物框 框N 主題」）→ 用來判斷要套用哪個顏色版型
//   主標=                                  → 標題第一行／第二行（依換行拆兩行）；
//                                            第一行如果是「(文字)----主標小色塊字」這種格式，
//                                            表示這是要放在主標上方的色塊字，會拆出來自動生成一個
//                                            「主標色塊字」裝飾色塊（位置不固定，套用後自己拖到主標上面），
//                                            剩下的行才是真正的標題第一行／第二行
//   小標=                                  → 對應 tag 欄位（頂部標籤文字，可兩行）
//   打卡=                                  → 對應 location 欄位（地點標）；如果主標=裡有拆出
//                                            主標色塊字，套用時會自動勾選「有加主標色塊字」，
//                                            地點標跟著自動上移到左上角，不用手動勾
//   色塊=                                  → 每行「形狀:文字」，自動生成裝飾色塊（位置/顏色不固定，
//                                            所以只負責生成內容，位置給預設值，套用後自己拖到對的地方）
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

// 色塊行的形狀關鍵字（跟 badges.ts 的 BADGE_SHAPE_LABELS 對應），
// 生成時預設用紅色，套用到畫布上後可以自己點色盤換顏色。
const SHAPE_KEYWORD_TO_ID: Record<string, BadgeShape> = Object.fromEntries(
  (Object.keys(BADGE_SHAPE_LABELS) as BadgeShape[]).map((id) => [BADGE_SHAPE_LABELS[id], id])
) as Record<string, BadgeShape>;
const DEFAULT_BADGE_COLOR = "#C0000A";

// 主標=裡「(文字)----主標小色塊字」這行專用的偵測 pattern，抓出 ---- 前面的文字內容。
const TITLE_BADGE_MARKER = /^(.*)----\s*主標小色塊字\s*$/;
// 工單沒有指定要用哪一款色塊時，預設用 01（黃底），套用後可以自己刪掉換別款重加。
const DEFAULT_TITLE_BADGE_SHAPE: BadgeShape = "title-badge-01";

interface ParsedBadge {
  shape: BadgeShape;
  shapeLabel: string;
  text: string;
}

interface ParsedTicket {
  templateId: string | null;
  colorKeyword: string | null;
  frameNumber: string | null;
  /** 判斷顏色/框號那一行的原始文字，例如「紅色人物框　框12飛車逮通緝」，
   *  拿來當下載檔名用（比版型ID+時間戳記更容易辨識是哪張工單）。 */
  rawTitleLine: string | null;
  tag: string | null;
  title1: string | null;
  title2: string | null;
  titleBadgeText: string | null;
  location: string | null;
  warn: string | null;
  badges: ParsedBadge[];
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
    rawTitleLine: null,
    tag: null,
    title1: null,
    title2: null,
    titleBadgeText: null,
    location: null,
    warn: null,
    badges: [],
    ignoredLines: [],
  };

  // 一段是不是「另一個區塊標記」的開頭，用來判斷 主標= 該在哪裡停止往後併段落。
  const isKnownMarkerBlock = (b: string) =>
    b.startsWith("主標=") ||
    b.startsWith("小標=") ||
    b.startsWith("警語=") ||
    b.startsWith("打卡=") ||
    b.startsWith("色塊=") ||
    /^\(SOU[:：]/i.test(b);

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    if (block.startsWith("主標=")) {
      // 主標= 底下可能因為「(文字)----主標小色塊字」那行後面留了空白行，
      // 被切成好幾段；持續往後併段落，直到遇到下一個已知區塊標記為止，
      // 這樣「主標小色塊字」那行跟真正的標題第一行／第二行才不會被拆散。
      let merged = block.replace(/^主標=\s*/, "");
      let j = i + 1;
      while (j < blocks.length && !isKnownMarkerBlock(blocks[j])) {
        merged += "\n" + blocks[j];
        j++;
      }
      i = j;

      let lines = merged
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      // 第一行如果是「(文字)----主標小色塊字」，代表這是要放在主標上方的色塊字，
      // 先拆出來，剩下的行才是真正的標題第一行／第二行。
      const badgeMatch = lines[0] ? lines[0].match(TITLE_BADGE_MARKER) : null;
      if (badgeMatch) {
        result.titleBadgeText = badgeMatch[1].trim();
        lines = lines.slice(1);
      }
      result.title1 = lines[0] ?? null;
      result.title2 = lines[1] ?? null;
      continue;
    }

    if (block.startsWith("小標=")) {
      result.tag = block.replace(/^小標=\s*/, "").trim();
      i++;
      continue;
    }

    if (block.startsWith("警語=")) {
      result.warn = block.replace(/^警語=\s*/, "").trim();
      i++;
      continue;
    }

    if (block.startsWith("打卡=")) {
      // 打卡=後面常常直接接一行 (SOU:...) 備註、中間沒有空行分隔，只取第一行當地點，
      // 其餘行如果不是 (SOU:...) 備註才丟到「未解析」給人工看。
      const lines = block
        .replace(/^打卡=\s*/, "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      result.location = lines[0] ?? null;
      lines.slice(1).forEach((l) => {
        if (!/^\(SOU[:：]/i.test(l)) result.ignoredLines.push(l);
      });
      i++;
      continue;
    }

    if (block.startsWith("色塊=")) {
      const lines = block
        .replace(/^色塊=\s*/, "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      lines.forEach((line) => {
        const idx = line.indexOf(":");
        const idxFull = line.indexOf("：");
        const sep = idx >= 0 ? idx : idxFull;
        if (sep < 0) return;
        const shapeLabel = line.slice(0, sep).trim();
        const text = line.slice(sep + 1).trim();
        const shape = SHAPE_KEYWORD_TO_ID[shapeLabel];
        if (shape && text) {
          result.badges.push({ shape, shapeLabel, text });
        }
      });
      i++;
      continue;
    }

    // (SOU:...) 純備註，直接跳過不處理
    if (/^\(SOU[:：]/i.test(block)) {
      i++;
      continue;
    }

    // 還沒抓到顏色/框號時，優先檢查這段是不是「OO色人物框 框N ...」那行
    if (!result.colorKeyword) {
      const colorMatch = block.match(/(紅色?|紫色?|藍色?|綠色?)/);
      const frameMatch = block.match(/框(\d+)/);
      if (colorMatch || frameMatch) {
        if (colorMatch) result.colorKeyword = colorMatch[1];
        if (frameMatch) result.frameNumber = frameMatch[1];
        // 保留這行原始文字（例如「紅色人物框　框12飛車逮通緝」），下載檔名要用。
        result.rawTitleLine = block;
        i++;
        continue;
      }
    }

    // 其他抓不到規則的段落（例如發單人/手機那行）先留著給人工確認，不自動套用
    result.ignoredLines.push(block);
    i++;
  }

  if (result.colorKeyword) {
    result.templateId = COLOR_TO_TEMPLATE[result.colorKeyword] ?? null;
  }

  return result;
}

interface Props {
  decorationRef: RefObject<DecorationLayerHandle | null>;
}

export default function TicketImportPanel({ decorationRef }: Props) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<ParsedTicket | null>(null);
  const setTemplate = useEditorStore((s) => s.setTemplate);
  const setField = useEditorStore((s) => s.setField);
  const setExportTitle = useEditorStore((s) => s.setExportTitle);

  const handleParse = () => {
    // 每次按「解析」代表要開始處理一張新工單了，先把畫布上舊的裝飾色塊清空，
    // 不然舊色塊會一直留著，等一下「套用到畫布」加新的色塊時就會兩批疊在一起，
    // 每次都要手動再按一次「清空所有色塊」很麻煩。
    decorationRef.current?.clearAll();
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
    if (preview.location !== null) setField("location", preview.location);
    // 版型裡 warn 欄位預設會帶一句提示文字（例如「違法行為 請勿模仿」），
    // 如果這次工單沒有寫「警語=」，要主動清空，不然畫面會殘留預設警語小字。
    setField("warn", preview.warn ?? "");
    // 有主標色塊字又有地點標時，地點標要自動上移到左上角（紅色人物框02.psd 的規範），
    // 不用她自己再手動勾一次。
    setField("hasTitleBadge", Boolean(preview.titleBadgeText && preview.location));
    // 下載檔名改用工單裡「顏色人物框 框N ...」那一行原文（例如「紅色人物框　框12飛車逮通緝」），
    // 比原本的「版型ID-時間戳記」更容易辨識是哪張工單。
    setExportTitle(preview.rawTitleLine);

    // 色塊只負責生成內容，位置用預設值堆疊在畫面中間，套用完自己拖到對的地方，
    // 顏色也先給一個預設紅色，想換色直接在右側「裝飾色塊」面板點色盤即可。
    preview.badges.forEach((badge, i) => {
      decorationRef.current?.addBadge(badge.shape, badge.text, DEFAULT_BADGE_COLOR, {
        left: 330 + i * 30,
        top: 200 + i * 60,
      });
    });

    // 主標小色塊字：跟其他裝飾色塊一樣手動加上去，預設用 01（黃底）+ 預設位置，
    // 套用後自己拖到主標上面、想換款式就刪掉在「裝飾色塊」面板重新選款加一個。
    if (preview.titleBadgeText) {
      decorationRef.current?.addBadge(DEFAULT_TITLE_BADGE_SHAPE, preview.titleBadgeText, DEFAULT_BADGE_COLOR, {
        left: 330,
        top: 120,
      });
    }
  };

  return (
    <div>
      <div className="section-title">貼上工單文字自動生成</div>
      <div className="hint" style={{ marginBottom: 8 }}>
        直接貼上「說明」欄位的完整內容（含 主標= / 小標= / 打卡= / 色塊= 等區塊），按「解析」預覽拆解結果，
        確認沒問題再按「套用」寫入版型、欄位與裝飾色塊。主標=第一行如果是「(文字)----主標小色塊字」，
        會自動拆成一個放在主標上方的裝飾色塊；這時如果同時有 打卡= 地點，地點標會自動上移到左上角
        （紅色人物框02.psd 的規範，避免被色塊字擋到）。
      </div>
      <textarea
        rows={12}
        placeholder={
          "例：\n藍色人物框 框12七星潭刁車\n\n主標=\n(重大破案)----主標小色塊字\n\n不諳路況(闖七星潭)\n吉普車(陷海灘慘困)\n\n小標=\n吵鬧被阻暴(還縱火)\n母男友加(全家送辦)\n\n打卡=苗栗\n\n色塊=\n爆炸框(橫幅款):不來就辭總召!\n爆炸框(緞帶款):中元前後恐再漲"
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
          <div style={{ whiteSpace: "pre-wrap" }}>小標：{preview.tag ?? <em>（未偵測到）</em>}</div>
          <div>標題第一行：{preview.title1 ?? <em>（未偵測到）</em>}</div>
          <div>標題第二行：{preview.title2 ?? <em>（未偵測到）</em>}</div>
          {preview.titleBadgeText && (
            <div>
              主標色塊字：{preview.titleBadgeText}（自動用黃底款，套用後可自行更換）
              {preview.location && "，地點標會自動上移到左上角"}
            </div>
          )}
          {preview.location !== null && <div>打卡地點：{preview.location}</div>}
          {preview.warn !== null && <div>警語：{preview.warn}</div>}
          {preview.badges.length > 0 && (
            <div>
              裝飾色塊：
              {preview.badges.map((b, i) => (
                <div key={i}>
                  　{b.shapeLabel}：{b.text}
                </div>
              ))}
            </div>
          )}
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
