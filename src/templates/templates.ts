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
      // letterSpacing 補回 1.5px 避免字擠在一起；maxWidth 抓 380——9 個字（約 374px，
      // PSD 最新單行示範字「竟是殺人未遂通緝犯」剛好 9 個字）塞得下不會壓縮，
      // 10 個字以上（約 415px）才會觸發壓縮：字的「高度」維持不變，只把「寬度」壓縮
      // 塞進安全寬度內，這是 drawStrokedTextSegments 既有的 maxWidth 縮放機制
      // （ctx.scale 只壓 X 軸），不用額外寫邏輯。
      // 邊框改成 4px：重新比對 PSD 才發現 PSD 的邊框是「外擴」畫在文字外側（Stroke
      // position = Outside，size 4），但 canvas 的 strokeText 是「置中」畫在文字線條
      // 正中間，畫完字（fillText）疊上去後只剩外側一半看得到，所以視覺上要跟 PSD
      // 的外擴邊框看起來一樣寬，實際 lineWidth 要設兩倍（4px，換算輸出解析度就是
      // PSD 的 8px≈視覺 4px 外擴邊框）。這就是之前「4px的邊不見了」一直沒抓對的原因。
      // 「紅／紫／藍／綠」四款統一改成用「安全框.png」這張（不要再各自比照不同的安全框檔案，
      // 不然標準會亂）。量出來透明安全區 1920 空間 x=106~1841、y=45~1015，換算 960
      // 工作畫布是 x=53~920.5、y=22.5~507.5，右邊界再往內收約 10px 當緩衝（給邊框外擴的
      // 視覺寬度留空間），得到這裡統一使用的 SAFE_RIGHT=910。
      // 起點 x=536 + maxWidth 抓在 910 以內：910-536=374，再留一點緩衝抓 366。
      name: "頂部標籤文字",
      draw: (ctx) => {
        const lines = (fields.tag as string).split("\n");
        // 第二行跟第一行太貼了，第二行往下移 2px（89→91）。
        const lineY = [49, 91];
        lines.slice(0, 2).forEach((line, i) => {
          drawStrokedTextSegments(ctx, parseColorMarkup(line, colors.tagBase, colors.tagAccent), 536, lineY[i], {
            font: "700 40px 'DFLiHei', sans-serif",
            stroke: "#ffffff",
            strokeWidth: 4,
            letterSpacing: 1.5,
            maxWidth: 366,
          });
        });
      },
    },
    {
      // 有加「主標色塊字」時，地點標的舊位置（左下、貼近標題）會被色塊字擋到，
      // 所以要照「紅色人物框02.psd」上移到左上角（不超出安全框，高度跟右邊小標對齊）。
      // 圖示要連同文字整組一起對齊「標題第一行」的字首，所以圖示本身的 x 就是跟標題第一行
      // 同一個值（57，見下面「標題第一行」那層的說明），文字維持在圖示右邊 34px 處。
      name: "地點 ICON（原始檔）",
      draw: (ctx) => {
        if (fields.showLocation === false) return;
        const icon = loadedIcons[imgKey];
        const h = 37,
          w = h * (icon ? icon.width / icon.height : 1);
        if (icon) {
          if (fields.hasTitleBadge) {
            ctx.drawImage(icon, 57, 18, w, h);
          } else {
            // 「地點在主標上方」這個狀態（沒有主標色塊字）之前漏改：主標第一行往前移到
            // x=57 之後，這裡跟文字都要跟著一起套用同樣的 -20 位移（77→57），才會對齊。
            const ICON_BOTTOM_ADJUST = 4;
            ctx.drawImage(icon, 57, 313 - h + ICON_BOTTOM_ADJUST, w, h);
          }
        }
      },
    },
    {
      // 同上，文字位置也比照「紅色人物框02.psd」上移。圖示（見上）對齊標題第一行字首 x=57，
      // 文字維持在圖示右邊原本的 34px 間距，57+34=91。
      name: "地點標籤文字",
      draw: (ctx) => {
        if (fields.showLocation === false) return;
        // 同上：「在主標上方」狀態的文字 x 之前漏改，跟著 icon 一起套用 -20 位移（116→96）。
        const [x, y] = fields.hasTitleBadge ? [91, 50] : [96, 313];
        drawStrokedText(ctx, (fields.location as string) || "地點", x, y, {
          font: "900 36.8px 'MStiffHeiHK', sans-serif",
          fill: colors.locationText,
          stroke: "#ffffff",
          strokeWidth: 2,
          maxWidth: fields.hasTitleBadge ? 400 : 520,
        });
      },
    },
    {
      // 重新比對「紅色人物框.psd」跟「紅色人物框02.psd」（兩份最新版本文字起點一致），
      // 量出來標題第一行文字 bbox 左邊界 1920 空間 x=113，換算 960 工作畫布 x=56.5，
      // 取整數 57（原本 77 太靠右，要往前移）。maxWidth 也跟著統一的安全框重算：
      // 910（SAFE_RIGHT，見「頂部標籤文字」的說明）-57=853，取 850。
      name: "標題第一行",
      draw: (ctx) => {
        drawStrokedTextSegments(
          ctx,
          parseColorMarkup(fields.title1 as string, colors.title1Base, colors.title1Accent),
          57,
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
      // PSD 量出來標題第二行 bbox 左邊界 1920 空間 x=562，換算 960 是 281，
      // 跟原本用的 284 幾乎一樣（誤差在四捨五入範圍內），維持不動，只更新 maxWidth：
      // 910-284=626，取 620。
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
            maxWidth: 620,
          }
        );
      },
    },
  ];
}

// 警語小字：位置跟著標題第一行的實際寬度走，四個緞帶框（紅/紫/藍/綠）共用同一套邏輯。
// 標題第一行字數一多（超過6字，含color markup解析後、括號本身不算進去的實際顯示字數），
// 警語小字接在標題後面同一排會被擠到安全框外面，所以改成搬到左上角：
//   - 左上角沒被地點佔走時：跟小標同一排高度對齊
//   - 有加主標色塊字（hasTitleBadge，這時地點會自動上移到左上角）：改放在地點下方，避免疊在一起
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
      const warnFont = "700 17px 'DFLiHei', sans-serif";
      // 統一改用「安全框.png」右邊界（見「頂部標籤文字」的說明，SAFE_RIGHT=910），
      // 警語小字跟其他文字欄位共用同一個安全框標準，不要再各自比照不同的檔案。
      const SAFE_RIGHT = 910;

      // parseColorMarkup 會把 () 本身吃掉、只留裡面的文字（見該函式），所以這裡算「字數」
      // 也要先把 () 拿掉，才是畫面上實際看到的字數，跟標題顯示效果一致。
      const title1RenderedLen = ((fields.title1 as string) || "").replace(/[()]/g, "").length;

      if (title1RenderedLen > 6) {
        // 「有加主標色塊字」時，地點標（見上面「地點標籤文字」那層）會自動上移到左上角
        // (x=71,y=50)，這種情況左上角已經被地點佔走，警語小字要往下讓一行、放在地點下方；
        // 沒有主標色塊字，或這次沒顯示地點，左上角是空的，直接放上去、跟小標同一排對齊。
        const locationAtTopLeft = Boolean(fields.hasTitleBadge) && fields.showLocation !== false;
        // 字首改成對齊「標題第一行」的字首（x=57，隨主標一起往前移），跟地點 icon 的新 x 一致；
        // 沒有地點卡在左上角時，也用同一個 x。
        const x = 57;
        // 地點的位置跟著 PSD 一起上移了（baseline 68→50），警語小字維持原本跟地點差
        // 24px 的間距，跟著一起上移：92→74。沒有地點卡在左上角的情況也要一起上移
        // （原本對齊小標 y=49，跟著同樣的 18px 上移幅度調成 31，不要只有「有地點」時才動）。
        const y = locationAtTopLeft ? 74 : 31;
        // 安全框範圍內自動壓縮寬度（跟小標/地點同一套 maxWidth 壓縮機制），文字不會超框。
        const maxWidth = locationAtTopLeft ? 400 : SAFE_RIGHT - x;
        drawStrokedText(ctx, fields.warn as string, x, y, {
          font: warnFont,
          fill: warnColor,
          stroke: "#ffffff",
          strokeWidth: 4,
          align: "left",
          maxWidth,
        });
        return;
      }

      // 標題第一行字數不多（6字以內）：維持原本邏輯，接在標題後面同一排。
      const title1Segs = parseColorMarkup(fields.title1 as string, colors.title1Base, colors.title1Accent);
      // 跟著「標題第一行」的 maxWidth 一起改（現在是 850），不然這裡量出來的寬度跟實際畫出來的對不上。
      const title1Width = measureRenderedWidth(ctx, title1Segs, "900 97.5px 'MStiffHeiHK', sans-serif", 0, 850);
      ctx.font = warnFont;
      const warnTextWidth = ctx.measureText(fields.warn as string).width;
      let warnX = 57 + title1Width + 24;
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
      { key: "tag", label: "頂部標籤文字（可兩行，每行9字內，() 內為紅色強調）", default: "吵鬧被阻暴(還縱火)\n母男友加(全家送辦)" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "台中" },
      {
        key: "hasTitleBadge",
        type: "checkbox",
        label: "有加主標色塊字（地點標會自動上移到左上角，避免被色塊字擋到）",
        default: false,
      },
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
      { key: "tag", label: "頂部標籤文字（可兩行，每行9字內，() 內為紫色強調）", default: "本人回應(詳情待查)\n對外一律不評論" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      {
        key: "hasTitleBadge",
        type: "checkbox",
        label: "有加主標色塊字（地點標會自動上移到左上角，避免被色塊字擋到）",
        default: false,
      },
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
        // 跟 PSD 的 Color Picker 核對過：強調色是純黃 #FFFF00（原本 #FFF002 差一點點）。
        title1Accent: "#FFFF00",
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
      { key: "tag", label: "頂部標籤文字（可兩行，每行9字內，() 內為藍紫強調）", default: "(重要)路況提醒\n請提早改道行駛" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      {
        key: "hasTitleBadge",
        type: "checkbox",
        label: "有加主標色塊字（地點標會自動上移到左上角，避免被色塊字擋到）",
        default: false,
      },
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
      { key: "tag", label: "頂部標籤文字（可兩行，每行9字內，() 內為金黃強調）", default: "關鍵橘子(遲未返台)\n各界持續施壓中" },
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "地點（也可放其他小資訊）", default: "地點" },
      {
        key: "hasTitleBadge",
        type: "checkbox",
        label: "有加主標色塊字（地點標會自動上移到左上角，避免被色塊字擋到）",
        default: false,
      },
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
      { key: "sub", label: "下方說明文字（() 內為紅色強調，例如「丟書包.壓脖.(逼面壁吃飯)」）", default: "當事人回應：詳情尚待查證" },
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
            EYEBROW_BASELINE_Y = 66;
          // 縮小成 0.95：32.7 * 0.95 = 31.065
          const EYEBROW_FONT = "700 31.07px 'DFLiHei', sans-serif";
          const LINE_LEFT_X = 0,
            LINE_GAP = 14,
            LINE_Y = 52,
            LINE_H = 1.5;
          const EYEBROW_BIG_X_MATCH = 45.5;
          const EYEBROW_MAXWIDTH = EYEBROW_RIGHT_X - EYEBROW_BIG_X_MATCH;
          const EYEBROW_LETTER_SPACING = 2;
          // 高度再 +10%：0.99*1.1=1.089
          const EYEBROW_HSCALE = 0.99;
          const EYEBROW_VSCALE = 1.089;
          const text = (fields.eyebrow as string) || "還有";
          const textW = measureSingleRenderedWidth(
            ctx,
            text,
            EYEBROW_FONT,
            EYEBROW_LETTER_SPACING,
            EYEBROW_HSCALE,
            EYEBROW_MAXWIDTH
          );
          const lineRightX = EYEBROW_RIGHT_X - textW - LINE_GAP;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(LINE_LEFT_X, LINE_Y, Math.max(0, lineRightX - LINE_LEFT_X), LINE_H);
          drawStrokedText(ctx, text, EYEBROW_RIGHT_X, EYEBROW_BASELINE_Y, {
            font: EYEBROW_FONT,
            fill: "#ffffff",
            align: "right",
            letterSpacing: EYEBROW_LETTER_SPACING,
            hScale: EYEBROW_HSCALE,
            vScale: EYEBROW_VSCALE,
            maxWidth: EYEBROW_MAXWIDTH,
            // 照 PSD Layer Style 讀出來的 Drop Shadow 校正：Distance=9、Size=5、
            // Angle=135°（Use Global Light 沒勾，是這個圖層自己的角度）、Opacity=57%。
            // 1920 空間的 Distance/Size 換算 960 工作畫布除以 2＝4.5／2.5；
            // 135° 角度分解成 offsetX/offsetY：4.5*cos(45°)=4.5*sin(45°)≈3.18
            // （下右方向，跟角度 135°＝左上打光、影子往右下 的方向一致）。
            dropShadow: { color: "rgba(0,0,0,0.57)", blur: 2.5, offsetX: 3.18, offsetY: 3.18 },
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
          // 縮小成 95%：50.85 * 0.95 = 48.3075
          const FONT = "900 48.31px 'DFHeiUB', sans-serif";
          const segs = parseColorMarkup((fields.eyebrowBig as string) || "調電眼(心碎)", "#ffffff", "#fff000");
          const naturalWidth = measureRenderedWidth(ctx, segs, FONT, 0, null);
          const fitHScale = naturalWidth > 0 ? Math.min(TARGET_WIDTH / naturalWidth, MAX_HSCALE) : 1;
          // hScale 在原本自動縮放的結果上再乘 1.1（超出 TARGET_WIDTH 時，
          // drawStrokedTextSegments 自己的 maxWidth 壓縮邏輯還是會擋住，不會真的爆版）。
          // 高度再 +10%：0.99*1.1=1.089
          const dynHScale = fitHScale * 1.1;
          drawStrokedTextSegments(ctx, segs, EYEBROW_BIG_X, 122, {
            font: FONT,
            align: "left",
            hScale: dynHScale,
            vScale: 1.089,
            maxWidth: TARGET_WIDTH,
            // 照 PSD Layer Style 讀出來的 Drop Shadow 校正：Distance=9、Size=5、
            // Angle=135°（Use Global Light 沒勾，是這個圖層自己的角度）、Opacity=57%。
            // 1920 空間的 Distance/Size 換算 960 工作畫布除以 2＝4.5／2.5；
            // 135° 角度分解成 offsetX/offsetY：4.5*cos(45°)=4.5*sin(45°)≈3.18
            // （下右方向，跟角度 135°＝左上打光、影子往右下 的方向一致）。
            dropShadow: { color: "rgba(0,0,0,0.57)", blur: 2.5, offsetX: 3.18, offsetY: 3.18 },
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
        // 重新抓過「人物框大字.psd」，這行文字圖層本身是兩種顏色的複合字（不是純色）：
        // 用 psd-tools 讀 StyleRun 量出來，前半段（"丟書包.壓脖."）是 #655437（原本就在用的
        // 那個棕色），後半段（"逼面壁吃飯"）是 #B90000（跟「地點」的紅色是同一個顏色）。
        // 所以這裡改成跟其他欄位一樣支援 () 強調色標記，() 內的文字用 #B90000。
        name: "下方說明文字",
        draw: (ctx) => {
          const SUB_BLOCK_CENTER_Y = 485,
            SUB_X = 480,
            SAFE_RIGHT = 937;
          const segs = parseColorMarkup((fields.sub as string) || "當事人回應：詳情尚待查證", "#655437", "#B90000");
          drawStrokedTextSegments(ctx, segs, SUB_X, SUB_BLOCK_CENTER_Y + 13.01, {
            font: "900 39.17px 'DFLiHeiBd', sans-serif",
            align: "left",
            maxWidth: SAFE_RIGHT - SUB_X - 5,
            hScale: 1.0,
            vScale: 1.1,
          });
        },
      },
      {
        // 邊框粗細：指定值，畫法是先畫邊框、再疊字蓋掉內側一半，這個數值換算到輸出圖上
        // 剛好等於實際看到的邊框寬度（見這層 draw 邏輯本身不做額外縮放）。
        // 字級放大成 105%（112→117.6），陰影照 PSD Layer Style 加回來（Distance=21、
        // Size=9，都是 1920 空間量到的值，換算 960 工作畫布除以 2＝offsetY 10.5、
        // blur 4.5；Angle=90°+Use Global Light＝正下方，offsetX=0），
        // 字距縮小一點（letterSpacing -4）。
        name: "主標題",
        draw: (ctx) => {
          const lines = String(fields.title || "師(抓頸抬童)!\n控(準公幼涉虐)").split("\n");
          const FONT = "900 117.6px 'MStiffHeiHK', sans-serif";
          const TITLE_MAXWIDTH = 460;
          lines.forEach((line, i) => {
            const y = 299 + i * 127;
            const segs = parseColorMarkup(line, "#ffffff", "#fff000");
            drawStrokedTextSegments(ctx, segs, 462.5, y, {
              font: FONT,
              stroke: "#2f3650",
              strokeWidth: 6,
              letterSpacing: -4,
              maxWidth: TITLE_MAXWIDTH,
              dropShadow: { color: "rgba(47,54,80,0.51)", blur: 4.5, offsetX: 0, offsetY: 10.5 },
            });
          });
        },
      },
      {
        // 用「安全框左邊界」跟「主標題字首」中間置中：安全框.png 校正後（見對話中換新版
        // 安全框圖檔那次）量出來的透明安全區左邊界，1920 空間 x=106，換算 960 工作畫布
        // x=53，跟主標題字首 x=462.5 之間取中點，centerX=(53+462.5)/2=257.75。
        // 這個 SAFE_LEFT=53 跟緞帶版型（頂部標籤文字/標題第一行）共用同一套安全框標準。
        name: "警語小字",
        draw: (ctx) => {
          if (!fields.warn) return;
          const SAFE_LEFT = 53;
          const TITLE_START_X = 462.5;
          const centerX = (SAFE_LEFT + TITLE_START_X) / 2;
          drawStrokedText(ctx, fields.warn as string, centerX, 498.79, {
            font: "900 18px 'DFLiHeiBdP', sans-serif",
            fill: "#ffffff",
            stroke: "#000000",
            strokeWidth: 4,
            letterSpacing: 0.45,
            align: "center",
            maxWidth: TITLE_START_X - SAFE_LEFT - 20,
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
      { key: "showLocation", type: "checkbox", label: "顯示地點資訊", default: true },
      { key: "location", label: "左上地點", default: "基隆" },
      { key: "banner", label: "頂部公告文字（() 內紅色強調）", default: "主題確定兩年半發行" },
      { key: "title1", label: "標題第一行（() 內黃色強調）", default: "(新台幣)改版" },
      { key: "title2", label: "標題第二行（() 內藍色強調）", default: "(鈔票)要換了" },
      { key: "tagSmall", label: "左下小標籤（() 內黃色強調）", default: "兌現(12強冠軍)鈔？" },
      { key: "note", label: "補充說明（() 內紅色強調）", default: "單張成本估(增1.5元)" },
    ],
    build: (fields) => [
      whiteBgLayer(),
      frameLayer("circle"),
      {
        // 新增左上角地點標，直接比照「紅色人物框」有主標色塊字時、地點上移到左上角那組座標
        // （icon (57,18)、文字 (91,50)），不是另外量的新位置。顏色也比照紅色人物框的
        // locationText（#B90000）跟白邊。
        name: "地點",
        draw: (ctx) => {
          if (fields.showLocation === false) return;
          const icon = loadedIcons.red;
          const h = 37,
            w = h * (icon ? icon.width / icon.height : 1);
          if (icon) {
            ctx.drawImage(icon, 57, 18, w, h);
          }
          drawStrokedText(ctx, (fields.location as string) || "基隆", 91, 50, {
            font: "900 36.8px 'MStiffHeiHK', sans-serif",
            fill: "#B90000",
            stroke: "#ffffff",
            strokeWidth: 2,
            maxWidth: 400,
          });
        },
      },
      {
        // 補上 () 紅色強調（PSD 用色盤量出來是 c50000，跟「補充說明」共用同一個紅），
        // 原本直接用 drawStrokedText 畫整串純色字，改成跟其他欄位一樣先 parseColorMarkup
        // 拆成分段、再用 drawStrokedTextSegments 畫（支援同一組 align/hScale/vScale/maxWidth 參數）。
        name: "頂部公告文字",
        draw: (ctx) => {
          const BASELINE_Y = 137 - 1.875;
          const segs = parseColorMarkup((fields.banner as string) || "主題確定兩年半發行", "#4a4e5d", "#c50000");
          drawStrokedTextSegments(ctx, segs, 723, BASELINE_Y, {
            font: "900 43.14px 'DFLiHeiBdP', sans-serif",
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
        // 字尾（右邊界）最多可以跟標題第二行的右邊界一樣：第二行是 x=393+maxWidth=528，
        // 右邊界 393+528=921；第一行 x=342.5，maxWidth 改成 921-342.5=578.5，
        // 這樣兩行字塞滿時右邊界會對齊。
        name: "標題第一行",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.title1 as string) || "(新台幣)改版", "#ffffff", "#fff000");
          drawStrokedTextSegments(ctx, segs, 342.5, 292, {
            font: "900 140px 'MStiffHeiHK', sans-serif",
            stroke: "#2f3650",
            strokeWidth: 7,
            maxWidth: 578.5,
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
      // 底色塊＋小icon、補充說明底線這兩層原本是用 fillRect 畫純色矩形，這次換新版
      // 「圓框大字_底圖.png」之後，量出來底色塊其實是帶斜向漸層/浮雕的（不是純色 #3b4057，
      // 量測範圍落在 rgb(39,42,60)~rgb(59,64,87) 之間），已經直接畫進新底圖裡了；
      // 補充說明底線量出來還是純色 #fff000、位置也跟新底圖裡的一致。兩層都改成由
      // frameLayer("circle") 的底圖負責畫，這裡拿掉 fillRect，不然純色矩形會蓋掉底圖的漸層。
      {
        name: "左下小標籤文字",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.tagSmall as string) || "兌現(12強冠軍)鈔？", "#fefefe", "#ffff00");
          // 寬度 +10%：0.91*1.1=1.001
          drawStrokedTextSegments(ctx, segs, 68.5, 463.5 - 1.005, {
            font: "900 28.53px 'DFLiHeiBdP', sans-serif",
            hScale: 1.001,
            vScale: 1.1,
            letterSpacing: -0.57,
            maxWidth: 225.5,
          });
        },
      },
      {
        name: "補充說明文字",
        draw: (ctx) => {
          const segs = parseColorMarkup((fields.note as string) || "單張成本估(增1.5元)", "#393939", "#c50000");
          // 寬度 +10%：1.0*1.1=1.1
          drawStrokedTextSegments(ctx, segs, 76, 499.5 - 1.005, {
            font: "900 22.5px 'DFLiHeiBd', sans-serif",
            hScale: 1.1,
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
        // 位置比照「圓框大字」左上角地點標（icon (57,18)、文字 (91,50)），
        // 不是另外量的新位置，顏色/白邊也一起比照。
        name: "左上地點標籤",
        draw: (ctx) => {
          const icon = loadedIcons.red;
          const h = 37,
            w = h * (icon ? icon.width / icon.height : 1);
          if (icon) {
            ctx.drawImage(icon, 57, 18, w, h);
          }
          drawStrokedText(ctx, (fields.location as string) || "宜蘭", 91, 50, {
            font: "900 36.8px 'MStiffHeiHK', sans-serif",
            fill: "#B90000",
            stroke: "#ffffff",
            strokeWidth: 2,
            maxWidth: 400,
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
          // 數字改用跟中文字一樣的 MStiffHeiHK 字體（原本英文字母跟數字都是同一個
          // ArialBlackEmbed 字體），所以拆成三種 unit：純數字 "digit"、純英文字母
          // "latin"、中文字 "cjk"，各自可能分開連續 run（同色才會合併）。
          const DIGIT_RE = /[0-9]/;
          const ALPHA_RE = /[A-Za-z]/;
          const units: { type: "latin" | "digit" | "cjk"; text?: string; ch?: string; fill: string }[] = [];
          rawChars.forEach((c) => {
            if (DIGIT_RE.test(c.ch)) {
              const last = units[units.length - 1];
              if (last && last.type === "digit" && last.fill === c.fill) last.text += c.ch;
              else units.push({ type: "digit", text: c.ch, fill: c.fill });
            } else if (ALPHA_RE.test(c.ch)) {
              const last = units[units.length - 1];
              if (last && last.type === "latin" && last.fill === c.fill) last.text += c.ch;
              else units.push({ type: "latin", text: c.ch, fill: c.fill });
            } else {
              units.push({ type: "cjk", ch: c.ch, fill: c.fill });
            }
          });
          // 字首（頂端）比照左上角地點標（打卡標）icon 的頂端 y=18，兩邊看起來同高。
          // 原本 BOX_TOP=35、BOX_H=472.5，底部邊界（BOX_TOP+BOX_H=507.5）維持不變，
          // 只把頂端往上移 17px，BOX_H 跟著補回同樣的 17px（507.5-18=489.5）。
          const VSCALE = 0.8,
            MAX_FONT = 85.23,
            BOX_TOP = 18,
            BOX_H = 489.5,
            ASCENT_RATIO = 0.669;
          const N = Math.max(units.length, 1);
          const fontSizeHalf = Math.min(MAX_FONT, BOX_H / (N * VSCALE));
          const STEP = fontSizeHalf * VSCALE;
          const FONT = `900 ${fontSizeHalf}px 'MStiffHeiHK', sans-serif`;
          // 寬度 1.5 倍：只加寬中文字（原本沒設 hScale，預設1，改成 1.5），
          // 英數字維持原本的 0.68，不跟著放大（英數字錨點本來就比較靠右側，
          // 放大後會超出安全框，維持原寬度才不會超框）。
          // 中文字實測 1.5 倍會超出右側色塊圖（量出來左邊界約 x=830）跟安全框右邊界
          // （安全框.png 量出來約 x=920.5），錨點 x=878 置中，兩邊各自安全距離取較窄的
          // 那邊（920.5-878=42.5），兩邊合起來 maxWidth=85，超過時用既有的自動壓縮機制
          // （drawStrokedText 的 maxWidth 參數）壓回來，不會整批都固定 1.5 倍。
          const CJK_HSCALE = 1.5;
          const CJK_MAX_WIDTH = 85;
          const LATIN_FONT_HALF = 101.355,
            LATIN_HSCALE = 0.68,
            LATIN_VSCALE = 0.8;
          const LATIN_FONT = `900 ${LATIN_FONT_HALF}px 'ArialBlackEmbed', 'Arial Black', Arial, sans-serif`;
          const LATIN_STEP = LATIN_FONT_HALF * LATIN_VSCALE;
          const Y1 =
            BOX_TOP +
            (units[0] && units[0].type === "latin" ? ASCENT_RATIO * LATIN_FONT_HALF : ASCENT_RATIO * fontSizeHalf);
          let y = Y1;
          units.forEach((u, idx) => {
            if (u.type === "latin" && idx === 0) {
              // 字首英文（例如 "EZWay" 放在最上面）：維持原本設計，貼右側、比較寬鬆的
              // 錨點跟寬度上限，這是配合最上面三角形裝飾區域留白比較多的版面。
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
            } else if (u.type === "latin") {
              // 英文不是字首、出現在中間或後面：原本沿用字首那組貼右側、較寬的錨點／寬度，
              // 中間的紫色色塊比頂端窄，會超出色塊跟安全框（位置跑掉）。改成跟中文字、
              // 數字共用同一個已驗證安全的置中框（x=878、maxWidth=85），寬度自動壓縮，
              // 不會再超框。用實際墨色邊界修正錨點，讓視覺置中跟中文字對齊（跟數字那組
              // 同一套修正邏輯）。
              //
              // 另外兩個問題一起修：
              // 1) 跟上一行中文字重疊：原本沿用字首那組固定的大字體（101px）跟固定行高
              //    LATIN_STEP，跟中文字動態縮放的行高 STEP 對不上，字數一多、中文字行高
              //    縮小了，英文那一行還是用原本沒縮小的固定行高，字就會跟上一行黏在一起。
              //    改成跟中文字共用同一套動態行高 STEP，行距才會一致，不會重疊。
              // 2) 邊框過粗：原本固定用 101px 大字體，硬靠 hScale 壓成 85px 寬（"alpha" 這種
              //    5個字母壓縮比例非常誇張），而邊框粗細的補償公式（除以 finalHScale）只補
              //    水平方向，垂直方向補不到，壓縮比例越誇張、垂直邊框看起來就越粗。改成先
              //    依字數算出一個「自然寬度就已經接近安全寬度」的字體大小，不需要再靠 hScale
              //    硬壓，邊框粗細才會跟中文字一致。
              const dynLatinProbeFont = `900 ${fontSizeHalf}px 'ArialBlackEmbed', 'Arial Black', Arial, sans-serif`;
              ctx.font = dynLatinProbeFont;
              const naturalW = ctx.measureText(u.text!).width;
              const fitFontSize = naturalW > CJK_MAX_WIDTH ? fontSizeHalf * (CJK_MAX_WIDTH / naturalW) : fontSizeHalf;
              const midLatinFont = `900 ${fitFontSize}px 'ArialBlackEmbed', 'Arial Black', Arial, sans-serif`;
              ctx.font = midLatinFont;
              ctx.textAlign = "center";
              const lm = ctx.measureText(u.text!);
              const inkOffset = ((lm.actualBoundingBoxLeft || 0) - (lm.actualBoundingBoxRight || 0)) / 2;
              drawStrokedText(ctx, u.text!, 878 + inkOffset, y, {
                font: midLatinFont,
                fill: u.fill,
                stroke: "#401c80",
                strokeWidth: 6 / VSCALE,
                align: "center",
                maxWidth: CJK_MAX_WIDTH,
                vScale: VSCALE,
              });
              y += STEP;
            } else if (u.type === "digit") {
              // 數字用 MStiffHeiHK（跟中文字同字體同大小 fontSizeHalf，會隨字數 N 一起縮放），
              // 寬度上限直接沿用中文字已經驗證過安全的 maxWidth=85，
              // 保證數字（不管幾位數）一定不會超出底部色塊（左邊界約x=830）或安全框（右邊界約x=920.5）。
              // 置中對齊：textAlign=center 是用「字寬（advance width）」置中，但數字（尤其像
              // "1" 這種窄字）左右留白不對稱，視覺上的墨色中心會偏離幾何中心，導致跟中文字
              // 對不齊（實測「180」視覺中心比中文字偏左約9px）。這裡改用 actualBoundingBox
              // 量出真正的墨色左右邊界，算出偏移量去修正錨點，讓數字的視覺中心對齊中文字的
              // x=878，而不是只對齊字寬的幾何中心。
              ctx.font = FONT;
              ctx.textAlign = "center";
              const dm = ctx.measureText(u.text!);
              const inkOffset = ((dm.actualBoundingBoxLeft || 0) - (dm.actualBoundingBoxRight || 0)) / 2;
              drawStrokedText(ctx, u.text!, 878 + inkOffset, y, {
                font: FONT,
                fill: u.fill,
                stroke: "#401c80",
                strokeWidth: 6 / VSCALE,
                align: "center",
                maxWidth: CJK_MAX_WIDTH,
                vScale: VSCALE,
              });
              y += STEP;
            } else {
              drawStrokedText(ctx, u.ch!, 878, y, {
                font: FONT,
                fill: u.fill,
                stroke: "#401c80",
                strokeWidth: 6 / VSCALE,
                align: "center",
                hScale: CJK_HSCALE,
                maxWidth: CJK_MAX_WIDTH,
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
