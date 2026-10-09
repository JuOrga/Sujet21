import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs'
export const VT_INIT = `(() => {
  let vt = 1000
  const dateBase = Date.now()
  const rn = performance.now.bind(performance)
  let f0 = rn()
  // dans une image, le temps avance au dixième du réel : les boucles à budget se terminent
  const now = () => vt + Math.min(8, (rn() - f0) * 0.1)
  performance.now = now
  Date.now = () => dateBase + now()
  let q = new Map(), nid = 1
  window.requestAnimationFrame = (cb) => { const id = nid++; q.set(id, cb); return id }
  window.cancelAnimationFrame = (id) => { q.delete(id) }
  window.__vt = () => vt
  window.__step = (ms) => {
    vt += ms
    f0 = rn()
    const cur = q; q = new Map()
    for (const cb of cur.values()) { try { cb(vt) } catch (e) { console.error('rAF', e && e.stack || e) } }
    return cur.size
  }
  window.__grab = (q) => {
    const gl = document.getElementById('glcanvas'), fx = document.getElementById('fx-canvas')
    let o = window.__o
    if (!o || o.width !== gl.width || o.height !== gl.height) { o = window.__o = document.createElement('canvas'); o.width = gl.width; o.height = gl.height }
    const c = o.getContext('2d')
    c.fillStyle = '#000'; c.fillRect(0, 0, o.width, o.height)
    c.drawImage(gl, 0, 0)
    if (!window.__sansFx && fx && fx.width > 0 && getComputedStyle(fx).display !== 'none') c.drawImage(fx, 0, 0, o.width, o.height)
    return o.toDataURL('image/jpeg', q || 0.92)
  }
  window.__stepGrab = (ms, q) => { window.__step(ms); return window.__grab(q) }
})()`
export async function ouvre(url, { w = 540, h = 960, dsf = 2 } = {}) {
  const gpu = process.env.GPU || 'llvm'
  const args = gpu === 'llvm'
    ? ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-gpu-vsync', '--disable-gpu-watchdog', '--disable-features=GpuWatchdog', '--autoplay-policy=no-user-gesture-required']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
  const b = await chromium.launch({ headless: gpu !== 'llvm', args, env: { ...process.env, DISPLAY: ':99' } })
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, hasTouch: false })
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log('ERR', m.text().slice(0, 300)) })
  p.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 300)))
  await p.route('**/*', (r) => {
    const u = r.request().url()
    if (!u.startsWith('http://127.0.0.1')) return r.abort()
    if (u.includes('/api/')) return r.fulfill({ status: 404, body: '' })
    return r.continue()
  })
  await p.addInitScript(VT_INIT)
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  const cdp = await p.context().newCDPSession(p)
  return { b, p, cdp }
}
export async function step(p, n = 1, ms = 1000 / 60) {
  for (let i = 0; i < n; i++) await p.evaluate((ms) => window.__step(ms), ms)
}
export async function shot(cdp, path, fs) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 })
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'))
}

export async function stepGrab(p, path, fs, ms = 1000 / 60) {
  const d = await p.evaluate((ms) => window.__stepGrab(ms), ms)
  fs.writeFileSync(path, Buffer.from(d.split(',')[1], 'base64'))
}
export async function signe(p) {
  await p.waitForSelector('#sig-nom', { state: 'attached' })
  await p.evaluate(() => { const s = document.getElementById('signature'); if (s && !s.hidden) { document.getElementById('sig-nom').value = 'GOUTTE'; document.getElementById('sig-valider').click() } })
}
