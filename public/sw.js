// 最小 Service Worker —— 仅用于满足 PWA「可安装」判定，从而让安卓 / 桌面 Chrome
// 触发 beforeinstallprompt（一键添加到桌面）。
//
// 刻意不做任何缓存：fetch 监听器存在即可解锁安装资格，但不调用 respondWith，
// 所有请求原样走网络（与没有 SW 时行为完全一致）。这样：
//   - 不引入离线/陈旧缓存风险（部署即时生效，不会留旧版前端）
//   - 不干扰 /api 请求、/viz iframe、KaTeX 字体等流式/Range
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {
  // 故意留空：仅以「存在 fetch handler」满足安装判定，不接管任何请求。
})
