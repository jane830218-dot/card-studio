import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages 會把網站放在 https://<帳號>.github.io/<repo名稱>/ 這個子路徑下，
  // 所以「正式建置」(npm run build) 時要告訴 Vite 網站的根目錄不是 "/"，
  // 而是 "/card-studio/"，不然圖片、字體、JS 檔案的路徑會抓錯，網站會變成空白或跑版。
  // 但「本機開發」(npm run dev) 仍維持 "/"，不受影響，跟以前一樣用 localhost:5173 打開。
  base: command === 'build' ? '/card-studio/' : '/',
}))
