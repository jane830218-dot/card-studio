// 素材路徑與預載邏輯 —— 對應 demo 裡的 BASE_IMAGES / ICON_IMAGES + preloadAll()，
// 差別只是原本 demo 用 base64 內嵌，這裡改成引用 public/assets 底下的實際檔案。

// 注意：public/ 底下的檔案路徑要用 import.meta.env.BASE_URL 開頭，
// 而不是寫死的 "/"。因為部署到 GitHub Pages 時，網站根目錄其實是
// "/card-studio/"（不是 "/"），如果寫死 "/assets/..." 會抓不到檔案。
// 在自己電腦 npm run dev 時 BASE_URL 是 "/"，行為跟以前完全一樣，不受影響。
const BASE = import.meta.env.BASE_URL;

export const BASE_IMAGE_PATHS: Record<string, string> = {
  red: `${BASE}assets/backgrounds/red.png`,
  purple: `${BASE}assets/backgrounds/purple.png`,
  blue: `${BASE}assets/backgrounds/blue.png`,
  person: `${BASE}assets/backgrounds/person.png`,
  circle: `${BASE}assets/backgrounds/circle.png`,
  arrow: `${BASE}assets/backgrounds/arrow.png`,
  green: `${BASE}assets/backgrounds/green.png`,
};

export const ICON_IMAGE_PATHS: Record<string, string> = {
  red: `${BASE}assets/icons/red.png`,
  purple: `${BASE}assets/icons/purple.png`,
};
// 依專案慣例：地點 ICON 只有紅色/紫色兩種，沒特別強調時一律用紅色，
// 綠色/藍色版型的地點 icon 也共用紅色這份檔案。
ICON_IMAGE_PATHS.green = ICON_IMAGE_PATHS.red;
ICON_IMAGE_PATHS.blue = ICON_IMAGE_PATHS.red;

export const SAFE_FRAME_PATH = `${BASE}assets/safeframe/safeframe.png`;

export const loadedImages: Record<string, HTMLImageElement> = {};
export const loadedIcons: Record<string, HTMLImageElement> = {};
export let safeFrameImage: HTMLImageElement | null = null;

function loadOne(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

let preloadPromise: Promise<void> | null = null;

export function preloadAll(): Promise<void> {
  if (preloadPromise) return preloadPromise;
  const jobs: Promise<void>[] = [];
  Object.keys(BASE_IMAGE_PATHS).forEach((k) => {
    jobs.push(
      loadOne(BASE_IMAGE_PATHS[k])
        .then((img) => {
          loadedImages[k] = img;
        })
        .catch(() => {})
    );
  });
  Object.keys(ICON_IMAGE_PATHS).forEach((k) => {
    jobs.push(
      loadOne(ICON_IMAGE_PATHS[k])
        .then((img) => {
          loadedIcons[k] = img;
        })
        .catch(() => {})
    );
  });
  jobs.push(
    loadOne(SAFE_FRAME_PATH)
      .then((img) => {
        safeFrameImage = img;
      })
      .catch(() => {})
  );
  preloadPromise = Promise.all(jobs).then(() => undefined);
  return preloadPromise;
}

export const FONT_FAMILIES_TO_LOAD = [
  "900 40px 'MStiffHeiHK'",
  "700 16px 'DFLiHei'",
  "900 40px 'DFHeiUB'",
  "900 40px 'DFLiHeiBd'",
  "900 40px 'DFLiHeiBdP'",
  "900 40px 'ArialBlackEmbed'",
];

export function loadFonts(): Promise<void> {
  if (!(document as any).fonts || !(document as any).fonts.load) return Promise.resolve();
  return Promise.all(FONT_FAMILIES_TO_LOAD.map((f) => (document as any).fonts.load(f)))
    .then(() => undefined)
    .catch(() => undefined);
}
