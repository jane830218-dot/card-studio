// 版型定義 —— 逐行從 card-editor-demo-v5_22.html 移植過來。
// 所有座標／字級／顏色／描邊數字都是已經跟真實 PSD 圖層核對過的結果（demo 裡的註解保留原文），
// 這裡刻意不「順手優化」任何數字，避免不小心破壞已核對過的視覺效果。
import { loadedImages, loadedIcons } from "./assets";
import {
  drawStrokedText,
  drawStrokedTextSegments,
  parseColorMarkup,
  measureSingleRenderedWidth,
  measureRenderedWidth,
} from "./helpers";
import type { CardLayer, FieldValues, TemplateDef } from "./types";

function whiteBgLayer(): CardLayer {
  // isBgFill：標記這是「畫面預覽用」的白底墊色，不是真正的設計素材。
  // 正式輸出的透明底 PNG 要跳過這層，讓使用者自己疊到畫面上。
  return {
    name: "背景色（白）",
    isBgFill: true,
    draw: (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 960, 540);
    },
  };
}

// 底圖是「去背後的裝飾框」：透明區域是留給照片/情境圖的窗口，
// 所以正確疊圖順序是：白底 → 照片 → 底圖框架（蓋在照片上）→ 文字
function frameLayer(imgKey: string): CardLayer {
  return {
    name: "底圖框架（原始檔，未修改）",
    draw: (ctx) => {
      const img = loadedImages[imgKey];
      if (img) ctx.drawImage(img, 0, 0, 960, 540);
      else {
        ctx.fillStyle = "#ddd";
        ctx.fillRect(0, 0, 960, 540);
      }
    },
  };
}

// ---- 共用：紅／紫／藍／綠 四套版型結構相同（同一份底圖框架，只是換色）----
function buildRibbonTemplate(imgKey: string, colors: Record<string, string>) {
  return (fields: FieldValues): CardLayer[] => [
    whiteBgLayer(),
    {
      name: "人物/前景圖區",
      isImageSlot: true,
      draw: (ctx, img) => {
        if (!img) return;
        const scale = Math.min(380 / img.width, 540 / img.height);
        const w = img.width * scale,
          h = img.height * scale;
        ctx.drawImage(img, 0, 540 - h, w, h);
      },
    },
    frameLayer(imgKey),
    {
      // 右上小標改成兩行（座標跟字級都是從「裝飾色塊.psd」的新版兩行圖層量出來、換算到
      // 960×540 工作畫布：x=536、第一行 y=49、第二行 y=89）。
      // letterSpacing 補回 1.5px 避免字擠在一起；maxWidth 抓 350——8 個字（約 332px）
      // 塞得下不會壓縮，9 個字以上（約 374px）才會觸發壓縮：字的「高度」維持不變，
      // 只把「寬度」壓縮塞進安全寬度內，這是 drawStrokedTextSegments 既有的 maxWidth
      // 縮放機制（ctx.scale 只壓 X 軸），不用額外寫邏輯。
      name: "頂部標籤文字",
      draw: (ctx) => {
        const lines = (fields.tag as string).split("\n");
        const lineY = [49, 89];
        lines.slice(0, 2).forEach((line, i) => {
          drawStrokedTextSegments(ctx, parseColorMarkup(line, colors.tagBase, colors.tagAccent), 536, lineY[i], {
            font: "700 40px 'DFLiHei', sans-serif",
            stroke: "#ffffff",
            strokeWidth: 2,
            letterSpacing: 1.5,
            maxWidth: 350,
          });
        });
      },
    },
    {
      name: "地點 ICON（原始檔）",
      draw: (ctx) => {
        if (fields.showLocation === false) return;
        const icon = loadedIcons[imgKey];
        const ICON_BOTTOM_ADJUST = 4;
        if (icon) {
          const h = 37,
            w = h * (icon.width / icon.height);
          ctx.drawImage(icon, 77, 313 - h + ICON_BOTTOM_ADJUST, w, h);
        }
      },
    },
    {
      name: "地點標籤文字",
      draw: (ctx) => {
        if (fields.showLocation === false) return;
        drawStrokedText(ctx, (fields.location as string) || "地點", 116, 313, {
          font: "900 36.8px 'MStiffHeiHK', sans-serif",
          fill: colors.locationText,
          stroke: "#ffffff",
          strokeWidth: 2,
          maxWidth: 520,
        });
      },
    },
    {
      name: "標題第一行",
      draw: (ctx) => {
        drawStrokedTextSegments(
          ctx,
          parseColorMarkup(fields.title1 as string, colors.title1Base, colors.title1Accent),
          77,
          415,
          {
            font: "900 97.5px 'MStiffHeiHK', sans-serif",
            stroke: colors.title1Stroke,
            strokeWidth: 7,
            maxWidth: 850,
          }
        );
      },
    },
    {
      name: "標題第二行",
      draw: (ctx) => {
        drawStrokedTextSegments(
          ctx,
          parseColorMarkup(fields.title2 as string, colors.title2Base, colors.title2Accent),
          284,
          503,
          {
            font: "900 80px 'MStiffHeiHK', sans-serif",
            stroke: colors.title2Stroke,
            strokeWidth: 5,
            maxWidth: 640,
          }
        );
      },
    },
  ];
}

// 警語小字：位置跟著標題第一行的實際寬度走，四個緞帶框（紅/紫/藍/綠）共用同一套邏輯。
function withWarnText(
  layers: CardLayer[],
  fields: FieldValues,
  colors: Record<string, string>,
  warnColor: string
): CardLayer[] {
  layers.push({
    name: "警語小字",
    draw: (ctx) => {
      if (!fields.warn) return;
      const title1Segs = parseColorMarkup(fields.title1 as string, colors.title1Base, colors.title1Accent);
      const title1Width = measureRenderedWidth(ctx, title1Segs, "900 97.5px 'MStiffHeiHK', sans-serif", 0, 850);
      const warnFont = "700 17px 'DFLiHei', sans-serif";
      ctx.font = warnFont;
      const warnTextWidth = ctx.measureText(fields.warn as string).width;
      const SAFE_RIGHT = 937;
      let warnX = 77 + title1Width + 24;
      if (warnX + warnTextWidth > SAFE_RIGHT) warnX = SAFE_RIGHT - warnTextWidth;
      drawStrokedText(ctx, fields.warn as string, warnX, 417, {
        font: warnFont,
        fill: warnColor,
        stroke: "#ffffff",
        strokeWidth: 4,
        align: "left",
      });
    },
  });
  return layers;
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: "red-frame",
    name: "紅色人物框",
    thumbImg: "red",
    imageSlot: { x: 0, y: 0, w: 380, h: 540, fit: "cover" },
    fields: [
      { key: "tag", label: "頂部標籤文字（可兩行，每行預設8字，() 內為紅色強調）", default: "吵鬧被阻暴(還縱火)\n母男友加(全家送辦)" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "台中" },
      { key: "title1", label: "標題第一行（() 內為黃色強調）", default: "示範(新聞標題)" },
      { key: "title2", label: "標題第二行（() 內為紅色強調）", default: "效果(展示文字)" },
      { key: "warn", label: "警語小字（可留空）", default: "違法行為 請勿模仿" },
    ],
    build: (fields) => {
      const colors = {
        locationText: "#B90000",
        tagBase: "#000000",
        tagAccent: "#C0000A",
        title1Base: "#FFFFFF",
        title1Accent: "#FFF002",
        title1Stroke: "#C0000A",
        title2Base: "#000000",
        title2Accent: "#C0000A",
        title2Stroke: "#ffffff",
      };
      const layers = buildRibbonTemplate("red", colors)(fields);
      return withWarnText(layers, fields, colors, "#000000");
    },
  },
  {
    id: "purple-frame",
    name: "紫色人物框",
    thumbImg: "purple",
    imageSlot: { x: 0, y: 0, w: 380, h: 540, fit: "cover" },
    fields: [
      { key: "tag", label: "頂部標籤文字（可兩行，每行預設8字，() 內為紫色強調）", default: "本人回應(詳情待查)\n對外一律不評論" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      { key: "title1", label: "標題第一行（() 內為黃色強調）", default: "示範(新聞標題)" },
      { key: "title2", label: "標題第二行（() 內為紫色強調）", default: "效果(展示文字)" },
      { key: "warn", label: "警語小字（可留空）", default: "違法行為 請勿模仿" },
    ],
    build: (fields) => {
      const colors = {
        locationText: "#6131DD",
        tagBase: "#000000",
        tagAccent: "#6131DD",
        title1Base: "#FFFFFF",
        title1Accent: "#FFF002",
        title1Stroke: "#4C29DB",
        title2Base: "#000000",
        title2Accent: "#6131DD",
        title2Stroke: "#ffffff",
      };
      const layers = buildRibbonTemplate("purple", colors)(fields);
      return withWarnText(layers, fields, colors, "#000000");
    },
  },
  {
    id: "blue-frame",
    name: "藍色人物框",
    thumbImg: "blue",
    imageSlot: { x: 0, y: 0, w: 380, h: 540, fit: "cover" },
    fields: [
      { key: "tag", label: "頂部標籤文字（可兩行，每行預設8字，() 內為藍紫強調）", default: "(重要)路況提醒\n請提早改道行駛" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      { key: "title1", label: "標題第一行（() 內為青色強調）", default: "示範(新聞標題)" },
      { key: "title2", label: "標題第二行（() 內為藍紫強調）", default: "效果(展示文字)" },
      { key: "warn", label: "警語小字（可留空）", default: "違法行為 請勿模仿" },
    ],
    build: (fields) => {
      const colors = {
        locationText: "#B90000",
        tagBase: "#161F31",
        tagAccent: "#5C3FFD",
        title1Base: "#FFFFFF",
        title1Accent: "#00FFFF",
        title1Stroke: "#171E31",
        title2Base: "#171E31",
        title2Accent: "#5C3FFD",
        title2Stroke: "#ffffff",
      };
      const layers = buildRibbonTemplate("blue", colors)(fields);
      return withWarnText(layers, fields, colors, "#171E31");
    },
  },
  {
    id: "green-frame",
    name: "綠色人物框",
    thumbImg: "green",
    imageSlot: { x: 0, y: 0, w: 380, h: 540, fit: "cover" },
    fields: [
      { key: "tag", label: "頂部標籤文字（可兩行，每行預設8字，() 內為金黃強調）", default: "關鍵橘子(遲未返台)\n各界持續施壓中" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      { key: "title1", label: "標題第一行（() 內為黃綠強調）", default: "示範(新聞標題)" },
      { key: "title2", label: "標題第二行（() 內為金黃強調）", default: "效果(展示文字)" },
      { key: "warn", label: "警語小字（可留空）", default: "違法行為 請勿模仿" },
    ],
    build: (fields) => {
      const colors = {
        locationText: "#B90000",
        tagBase: "#161F31",
        tagAccent: "#A37B00",
        title1Base: "#FFFFFF",
        title1Accent: "#D6FF02",
        title1Stroke: "#17311C",
        title2Base: "#3A3636",
        title2Accent: "#7D5E00",
        title2Stroke: "#ffffff",
      };
      const layers = buildRibbonTemplate("green", colors)(fields);
      return withWarnText(layers, fields, colors, "#171E31");
    },
  },
  {
    id: "person-frame-big",
    name: "人物框大字",
    thumbImg: "person",
    imageSlot: { x: 0, y: 60, w: 630, h: 480, fit: "cover" },
    fields: [
      { key: "eyebrow", label: "眉批小字", default: "還有" },
      { key: "eyebrowBig", label: "眉批大字（() 內為黃色強調，例如「調電眼(心碎)」）", default: "調電眼(心碎)" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點", default: "基隆" },
      { key: "sub", label: "下方說明文字", default: "當事人回應：詳情尚待查證" },
      { key: "title", label: "主標題（可換行，() 內為黃色強調，例如「師(抓頸抬童)!」）", default: "師(抓頸抬童)!\n控(準公幼涉虐)" },
      { key: "warn", label: "警語小字（可留空）", default: "兒虐保護專線:113" },
    ],
    build: (fields) => [
      whiteBgLayer(),
      {
        name: "人物照片（如需替換）",
        isImageSlot: true,
        draw: (ctx, img) => {
          if (!img) return;
          const w = 470,
            h = 1000,
            scale = Math.max(w / img.width, h / img.height);
          const iw = img.width * scale,
            ih = img.height * scale;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 60, 630, 480);
          ctx.clip();
          ctx.drawImage(img, (630 - iw) / 2, 540 - ih, iw, ih);
          ctx.restore();
        },
      },
      frameLayer("person"),
      {
        name: "眉批裝飾線＋小字",
        draw: (ctx) => {
          const EYEBROW_RIGHT_X = 220,
            EYEBROW_BASELINE_Y = 68;
          const EYEBROW_FONT = "700 32.7px 'DFLiHei', sans-serif";
          const LINE_LEFT_X = 0,
            LINE_GAP = 14,
            LINE_Y = 52,
            LINE_H = 1.5;
          const EYEBROW_BIG_X_MATCH = 45.5;
          const EYEBROW_MAXWIDTH = EYEBROW_RIGHT_X - EYEBROW_BIG_X_MATCH;
          const text = (fields.eyebrow as string) || "還有";
          const textW = measureSingleRenderedWidth(ctx, text, EYEBROW_FONT, 0, 0.9, EYEBROW_MAXWIDTH);
          const lineRightX = EYEBROW_RIGHT_X - textW - LINE_GAP;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(LINE_LEFT_X, LINE_Y, Math.max(0, lineRightX - LINE_LEFT_X), LINE_H);
          drawStrokedText(ctx, text, EYEBROW_RIGHT_X, EYEBROW_BASELINE_Y, {
            font: EYEBROW_FONT,
            fill: "#ffffff",
            align: "right",
            hScale: 0.9,
            vScale: 1.1,
            maxWidth: EYEBROW_MAXWIDTH,
            dropShadow: { color: "rgba(0,0,0,0.57)", blur: 3, offsetX: 3, offsetY: 3 },
          });
        },
      },
      {
        name: "眉批大字",
        draw: (ctx) => {
          const RED_BLOCK_RIGHT_X = 233.5,
            EYEBROW_RIGHT_MARGIN = 13.5;
          const EYEBROW_BIG_X = 45.5;
          const TARGET_WIDTH = RED_BLOCK_RIGHT_X - EYEBROW_RIGHT_MARGIN - EYEBROW_BIG_X;
          const MAX_HSCALE = 1.3;
          const FONT = "900 50.85px 'DFHeiUB', sans-serif";
          const segs = parseColorMarkup((fields.eyebrowBig as string) || "調電眼(心碎)", "#ffffff", "#fff000");
          const naturalWidth = measureRenderedWidth(ctx, segs, FONT, 0, null);
          const dynHScale = naturalWidth > 0 ? Math.min(TARGET_WIDTH / naturalWidth, MAX_HSCALE) : 1;
          drawStrokedTextSegments(ctx, segs, EYEBROW_BIG_X, 126, {
            font: FONT,
            align: "left",
            hScale: dynHScale,
            vScale: 1.1,
            maxWidth: TARGET_WIDTH,
            dropShadow: { color: "rgba(0,0,0,0.57)", blur: 3, offsetX: 3, offsetY: 3 },
          });
        },
      },
      {
        name: "地點",
        draw: (ctx) => {
          if (fields.showLocation === false) return;
          const icon = loadedIcons.red;
          const TEXT_X = 83,
            BASELINE_Y = 181 + 2.1;
          const ICON_BOTTOM_ADJUST = 3.5;
          if (icon) {
            const h = 32,
              w = h * (icon.width / icon.height);
            ctx.drawImage(icon, TEXT_X - 14 - w, BASELINE_Y - h + ICON_BOTTOM_ADJUST, w, h);
          }
          drawStrokedText(ctx, (fields.location as string) || "基隆", TEXT_X, BASELINE_Y, {
            font: "900 36.8px 'MStiffHeiHK', sans-serif",
            fill: "#B90000",
            stroke: "#ffffff",
            strokeWidth: 2,
          });
        },
      },
      {
        name: "下方說明文字",
        draw: (ctx) => {
          const SUB_BLOCK_CENTER_Y = 485,
            SUB_X = 480,
            SAFE_RIGHT = 937;
          drawStrokedText(ctx, (fields.sub as string) || "當事人回應：詳情尚待查證", SUB_X, SUB_BLOCK_CENTER_Y + 13.01, {
            font: "900 39.17px 'DFLiHeiBd', sans-serif",
            fill: "#655437",
            align: "left",
            maxWidth: SAFE_RIGHT - SUB_X - 5,
            hScale: 1.0,
            vScale: 1.1,
          });
        },
      },
      {
        name: "主標題",
        draw: (ctx) => {
          const lines = String(fields.title || "師(抓頸抬童)!\n控(準公幼涉虐)").split("\n");
          const FONT = "900 112px 'MStiffHeiHK', sans-serif";
          const TITLE_MAXWIDTH = 460;
          lines.forEach((line, i) => {
            const y = 299 + i * 127;
            const segs = parseColorMarkup(line, "#ffffff", "#fff000");
            drawStrokedTextSegments(ctx, segs, 462.5, y, {
              font: FONT,
              stroke: "#2f3650",
              strokeWidth: 7,
              maxWidth: TITLE_MAXWIDTH,
              dropShadow: { color: "rgba(47,54,80,0.51)", blur: 4.5, offsetX: 0, offsetY: 10.5 },
            });
          });
        },
      },
      {
        name: "警語小字",
        draw: (ctx) => {
          if (!fields.warn) return;
          drawStrokedText(ctx, fields.warn as string, 158, 498.79, {
            font: "900 18px 'DFLiHeiBdP', sans-serif",
            fill: "#ffffff",
            stroke: "#000000",
            strokeWidth: 4,
            letterSpacing: 0.45,
            align: "left",
          });
        },
      },
    ],
  },
  {
    id: "circle-big",
    name: "圓框大字",
    thumbImg: "circle",
    fields: [
      { key: "banner", label: "頂部公告文字", default: "主題確定兩年半發行" },
      { key: "title1", label: "標題第一行（() 內黃色強調）", default: "(新台幣)改版" },
      { key: "title2", label: "標題第二行（() 內藍色強調）", default: "(鈔票)要換了" },
      { key: "tagSmall", label: "左下小標籤（() 內黃色強調）", default: "兌現(12強冠軍)鈔？" },
      { key: "note", label: "補充說明（() 內紅色強調）", default: "單張成本估(增1.5元)" },
    ],
    build: (fields) => [
      whiteBgLayer(),
      frameLayer("circle"),
      {
        name: "頂部公告文字",
        draw: (ctx) => {
          const BASELINE_Y = 137 - 1.875;
          drawStrokedText(ctx, (fields.banner as string) || "主題確定兩年半發行", 723, BASELINE_Y, {
            font: "900 43.14px 'DFLiHeiBdP', sans-serif",
            fill: "#4a4e5d",
            stroke: "#ffffff",
            strokeWidth: 5,
            align: "center",
            hScale: 0.964,
            vScale: 1.1,
            maxWidth: 400,
          });
        },
      },
      {
        name: "標題第一行",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.title1 as string) || "(新台幣)改版", "#ffffff", "#fff000");
          drawStrokedTextSegments(ctx, segs, 342.5, 292, {
            font: "900 140px 'MStiffHeiHK', sans-serif",
            stroke: "#2f3650",
            strokeWidth: 7,
            maxWidth: 531.5,
            dropShadow: { color: "rgba(47,54,80,0.51)", blur: 4.5, offsetX: 0, offsetY: 10.5 },
          });
        },
      },
      {
        name: "標題第二行",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.title2 as string) || "(鈔票)要換了", "#ffffff", "#00ffff");
          drawStrokedTextSegments(ctx, segs, 393, 438.5, {
            font: "900 140px 'MStiffHeiHK', sans-serif",
            stroke: "#2f3650",
            strokeWidth: 7,
            maxWidth: 528,
            dropShadow: { color: "rgba(47,54,80,0.51)", blur: 4.5, offsetX: 0, offsetY: 10.5 },
          });
        },
      },
      {
        name: "左下標籤底色塊＋小icon",
        draw: (ctx) => {
          ctx.fillStyle = "#3b4057";
          ctx.fillRect(52.5, 434.5, 253, 35.5);
          ctx.fillStyle = "#fff99c";
          ctx.fillRect(57, 441, 6.5, 6.5);
        },
      },
      {
        name: "左下小標籤文字",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.tagSmall as string) || "兌現(12強冠軍)鈔？", "#fefefe", "#ffff00");
          drawStrokedTextSegments(ctx, segs, 68.5, 463.5 - 1.005, {
            font: "900 28.53px 'DFLiHeiBdP', sans-serif",
            hScale: 0.91,
            vScale: 1.1,
            letterSpacing: -0.57,
            maxWidth: 225.5,
          });
        },
      },
      {
        name: "補充說明底線",
        draw: (ctx) => {
          ctx.fillStyle = "#fff000";
          ctx.fillRect(81, 509, 210.5, 2.5);
        },
      },
      {
        name: "補充說明文字",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.note as string) || "單張成本估(增1.5元)", "#393939", "#c50000");
          drawStrokedTextSegments(ctx, segs, 76, 499.5 - 1.005, {
            font: "900 22.5px 'DFLiHeiBd', sans-serif",
            hScale: 1.0,
            vScale: 1.1,
            maxWidth: 206,
          });
        },
      },
    ],
  },
  {
    id: "arrow-big",
    name: "箭頭框大字",
    thumbImg: "arrow",
    imageSlot: { x: 0, y: 0, w: 960, h: 540, fit: "cover" },
    fields: [
      { key: "location", label: "左上地點標籤", default: "宜蘭" },
      {
        key: "vertical",
        label: "直式標題（右側，() 內為薄荷綠強調；英數字會自動整串橫式書寫，不會逐字轉直）",
        default: "(EZWay)洩資風險增",
      },
      { key: "title1", label: "標題第一行（() 內薄荷綠強調，其餘白色）", default: "驚喜伴游賞鯨船" },
      { key: "title2", label: "標題第二行（() 內薄荷綠強調，其餘白色，字級比第一行大）", default: "導覽驚呼(20年)首見" },
    ],
    build: (fields) => [
      whiteBgLayer(),
      {
        name: "情境圖（如需替換）",
        isImageSlot: true,
        draw: (ctx, img) => {
          if (!img) return;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, 960, 540);
          ctx.clip();
          const scale = Math.max(960 / img.width, 540 / img.height);
          const w = img.width * scale,
            h = img.height * scale;
          ctx.drawImage(img, (960 - w) / 2, (540 - h) / 2, w, h);
          ctx.restore();
        },
      },
      frameLayer("arrow"),
      {
        name: "左上地點標籤",
        draw: (ctx) => {
          const icon = loadedIcons.red;
          const TEXT_X = 87,
            BASELINE_Y = 69.5;
          const ICON_BOTTOM_ADJUST = 3.5;
          if (icon) {
            const h = 37,
              w = h * (icon.width / icon.height);
            ctx.drawImage(icon, TEXT_X - 10 - w, BASELINE_Y - h + ICON_BOTTOM_ADJUST, w, h);
          }
          drawStrokedText(ctx, (fields.location as string) || "宜蘭", TEXT_X, BASELINE_Y, {
            font: "900 36.8px 'MStiffHeiHK', sans-serif",
            fill: "#b90000",
            maxWidth: 700,
          });
        },
      },
      {
        name: "直式標題",
        draw: (ctx) => {
          const text = (fields.vertical as string) || "(EZWay)洩資風險增";
          const segs = parseColorMarkup(text, "#ffffff", "#8bf9c0");
          const rawChars: { ch: string; fill: string }[] = [];
          segs.forEach((s) => {
            for (const ch of s.text) rawChars.push({ ch, fill: s.fill });
          });
          const LATIN_RE = /[A-Za-z0-9]/;
          const units: { type: "latin" | "cjk"; text?: string; ch?: string; fill: string }[] = [];
          rawChars.forEach((c) => {
            if (LATIN_RE.test(c.ch)) {
              const last = units[units.length - 1];
              if (last && last.type === "latin" && last.fill === c.fill) last.text += c.ch;
              else units.push({ type: "latin", text: c.ch, fill: c.fill });
            } else {
              units.push({ type: "cjk", ch: c.ch, fill: c.fill });
            }
          });
          const VSCALE = 0.8,
            MAX_FONT = 85.23,
            BOX_TOP = 35,
            BOX_H = 472.5,
            ASCENT_RATIO = 0.669;
          const N = Math.max(units.length, 1);
          const fontSizeHalf = Math.min(MAX_FONT, BOX_H / (N * VSCALE));
          const STEP = fontSizeHalf * VSCALE;
          const FONT = `900 ${fontSizeHalf}px 'MStiffHeiHK', sans-serif`;
          const LATIN_FONT_HALF = 101.355,
            LATIN_HSCALE = 0.68,
            LATIN_VSCALE = 0.8;
          const LATIN_FONT = `900 ${LATIN_FONT_HALF}px 'ArialBlackEmbed', 'Arial Black', Arial, sans-serif`;
          const LATIN_STEP = LATIN_FONT_HALF * LATIN_VSCALE;
          const Y1 =
            BOX_TOP +
            (units[0] && units[0].type === "latin" ? ASCENT_RATIO * LATIN_FONT_HALF : ASCENT_RATIO * fontSizeHalf);
          let y = Y1;
          units.forEach((u) => {
            if (u.type === "latin") {
              const LATIN_RIGHT_ANCHOR = 935.5;
              const naturalLatinW = measureSingleRenderedWidth(ctx, u.text!, LATIN_FONT, 0, LATIN_HSCALE, null);
              const avgCharW = naturalLatinW / Math.max(u.text!.length, 1);
              const latinMaxWidth = 154 + avgCharW * 0.5;
              drawStrokedText(ctx, u.text!, LATIN_RIGHT_ANCHOR, y, {
                font: LATIN_FONT,
                fill: u.fill,
                stroke: "#401c80",
                strokeWidth: 6 / LATIN_VSCALE,
                align: "right",
                hScale: LATIN_HSCALE,
                vScale: LATIN_VSCALE,
                maxWidth: latinMaxWidth,
              });
              y += LATIN_STEP;
            } else {
              drawStrokedText(ctx, u.ch!, 878, y, {
                font: FONT,
                fill: u.fill,
                stroke: "#401c80",
                strokeWidth: 6 / VSCALE,
                align: "center",
                vScale: VSCALE,
              });
              y += STEP;
            }
          });
        },
      },
      {
        name: "標題第一行＋第二行",
        draw: (ctx) => {
          const segs1 = parseColorMarkup((fields.title1 as string) || "驚喜伴游賞鯨船", "#ffffff", "#8bf9c0");
          const segs2 = parseColorMarkup((fields.title2 as string) || "導覽驚呼(20年)首見", "#ffffff", "#8bf9c0");
          const FONT1 = "900 55.1px 'DFLiHeiBdP', sans-serif";
          const FONT2 = "900 65px 'DFLiHeiBdP', sans-serif";
          const width1 = measureRenderedWidth(ctx, segs1, FONT1, 0, null);
          const LEFT_MARGIN = 49.5;
          const firstChar2 = segs2[0] && segs2[0].text ? segs2[0].text[0] : "";
          ctx.font = FONT2;
          const firstChar2Width = firstChar2 ? ctx.measureText(firstChar2).width : 0;
          const title1LeftEdge = LEFT_MARGIN + firstChar2Width * (2 / 3);
          const title1CenterX = title1LeftEdge + width1 / 2;
          drawStrokedTextSegments(ctx, segs1, title1CenterX, 415, {
            font: FONT1,
            stroke: "#401c80",
            strokeWidth: 6,
            align: "center",
          });
          drawStrokedTextSegments(ctx, segs2, LEFT_MARGIN, 488, {
            font: FONT2,
            stroke: "#401c80",
            strokeWidth: 6,
            align: "left",
          });
        },
      },
    ],
  },
];

export function getTemplateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
