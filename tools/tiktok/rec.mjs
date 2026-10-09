// Enregistreur scénarisé : node rec.mjs scenario.json
// scénario : { nom, url?, hook?, dsf, fps, duree, zoom?, actions: [{t, ...}] }
import fs from 'fs'
import { ouvre, step, stepGrab, signe } from './harness.mjs'
const sc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const dsf = sc.dsf ?? 2, fps = sc.fps ?? 30, W = 540, H = 960
const dir = `frames/${sc.nom}`
fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
const base = 'http://127.0.0.1:4173/'
const { b, p } = await ouvre(base + (sc.query ?? ''), { w: W, h: H, dsf })
if (sc.ls) { await p.evaluate((ls) => { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v) }, sc.ls); await p.reload({ waitUntil: 'domcontentloaded' }) }
await p.waitForTimeout(2500)
await step(p, 3); await signe(p); await step(p, 3)
if (sc.hook) await p.evaluate((h) => window[h](), sc.hook)
else await p.evaluate(() => document.getElementById('start').click())
await step(p, 2)
const corps = () => p.evaluate(() => {
  const s = window.__sim, c = window.__cam
  s.updatePlayerStats?.()
  return { x: s.stats.centroidX, y: s.stats.centroidY, vx: s.stats.velX, vy: s.stats.velY, n: s.playerCount, cx: c.x, cy: c.y, z: c.zoom, gaz: window.__input?.gasIntent, glace: window.__input?.freezeIntent }
})
const ecran = (c, wx, wy) => ({ x: W / 2 + (wx - c.cx) * c.z, y: H / 2 - (wy - c.cy) * c.z })
// pré-roulage (intro caméra) non enregistré
const pre = Math.round((sc.preroll ?? 0) * fps)
for (let i = 0; i < pre; i++) await step(p, 1, 1000 / fps)
if (sc.sansFx) await p.evaluate(() => { window.__sansFx = true })
if (sc.params) await p.evaluate((o) => Object.assign(window.__params, o), sc.params)
if (sc.zoom) await p.evaluate((z) => { window.__cam.manualZoom = z }, sc.zoom)
const N = Math.round(sc.duree * fps)
const acts = [...sc.actions].sort((a, b) => a.t - b.t)
let tenue = null // { dir:[dx,dy], r, jusqua }
let anims = []
let tirauto = null
let pilote = null // { wps, v, seuil, r, jusqua, i }
const journal = []
let souris = false
for (let f = 0; f < N; f++) {
  const t = f / fps
  while (acts.length && acts[0].t <= t + 1e-9) {
    const a = acts.shift()
    journal.push({ t, ...a })
    if (a.do === 'tenir') { tenue = { dir: a.dir, r: a.r ?? 90, jusqua: t + a.dur, relache: a.relache } }
    else if (a.do === 'pilote') { pilote = { wps: a.wps, v: a.v ?? 300, seuil: a.seuil ?? 0.35, r: a.r ?? 140, jusqua: t + (a.dur ?? 99), i: 0, rayon: a.rayon ?? 120 } }
    else if (a.do === 'stop') { pilote = null; tenue = null; if (souris) { await p.mouse.up(); souris = false } }
    else if (a.do === 'params') await p.evaluate((o) => Object.assign(window.__params, o), a.p)
    else if (a.do === 'down') { await p.mouse.move(a.x, a.y); await p.mouse.down() }
    else if (a.do === 'up') { await p.mouse.up() }
    else if (a.do === 'dash') {
      const c = await corps(); const L = Math.hypot(a.dir[0], a.dir[1])
      const px = W / 2 + (c.x - c.cx) * c.z + (a.dir[0] / L) * (a.r ?? 200), py = H / 2 - (c.y - c.cy) * c.z - (a.dir[1] / L) * (a.r ?? 200)
      await p.mouse.move(px, py); await p.mouse.down(); souris = true; journal.push({ t, dash: 1 })
      tenue = { dir: [0, 0], r: 0, jusqua: t + (a.vise ?? 0.25), fixe: true }
    }
    else if (a.do === 'anim') anims.push({ ...a, t0: t })
    else if (a.do === 'tirauto') { tirauto = { mires: a.mires, jusqua: t + a.dur, cool: a.cool ?? 1.2, fen: a.fen ?? 140, r: a.r ?? 400, vise: a.vise ?? 0.2, dernier: -9 } }
    else if (a.do === 'touche') await p.keyboard.press(a.key)
    else if (a.do === 'zoom') await p.evaluate((z) => { window.__cam.manualZoom = z }, a.z)
    else if (a.do === 'eval') await p.evaluate(a.js)
    else if (a.do === 'warp') await p.evaluate((w) => { window.__input.onTimeWarpChange?.(w) }, a.w)
  }
  if (tenue && tenue.fixe) { if (t >= tenue.jusqua) { await p.mouse.up(); souris = false; tenue = null } }
  else if (tenue) {
    const c = await corps()
    const [dx, dy] = tenue.dir, L = Math.hypot(dx, dy) || 1
    // on vise À L'OPPOSÉ du mouvement voulu : le corps part à l'inverse du pointeur
    const pt = ecran(c, c.x - (dx / L) * tenue.r / c.z * (tenue.monde ? 1 : 1), c.y - (dy / L) * tenue.r / c.z)
    // r est en pixels CSS
    const px = W / 2 + (c.x - c.cx) * c.z - (dx / L) * tenue.r, py = H / 2 - (c.y - c.cy) * c.z + (dy / L) * tenue.r
    await p.mouse.move(px, py)
    if (!souris) { await p.mouse.down(); souris = true; journal.push({ t, ejecte: 1 }) }
    if (t >= tenue.jusqua) { await p.mouse.up(); souris = false; tenue = null }
  }
  for (const an of anims) {
    const k = Math.min(1, Math.max(0, (t - an.t0) / an.dur)), e = k * k * (3 - 2 * k)
    const o = {}; for (const [cle, [de, a]] of Object.entries(an.p)) o[cle] = de + (a - de) * e
    await p.evaluate((o) => Object.assign(window.__params, o), o)
  }
  anims = anims.filter((an) => t - an.t0 <= an.dur + 0.05)
  if (tirauto && !tenue) {
    if (t >= tirauto.jusqua) tirauto = null
    else if (t - tirauto.dernier >= tirauto.cool) {
      const c = await corps()
      const m = tirauto.mires.find((m) => Math.abs(m[0] - (c.x + c.vx * 0.25)) < tirauto.fen && c.y > m[1])
      if (m) {
        const dx = m[0] - c.x, dy = m[1] - c.y, L = Math.hypot(dx, dy)
        const px = W / 2 + (c.x - c.cx) * c.z + (dx / L) * tirauto.r, py = H / 2 - (c.y - c.cy) * c.z - (dy / L) * tirauto.r
        await p.mouse.move(px, py); await p.mouse.down(); souris = true; journal.push({ t, tir: 1 })
        tenue = { fixe: true, jusqua: t + tirauto.vise }
        tirauto.dernier = t
      }
    }
  }
  if (pilote) {
    const c = await corps()
    let wp = pilote.wps[pilote.i]
    while (wp && Math.hypot(wp[0] - c.x, wp[1] - c.y) < pilote.rayon) { pilote.i++; wp = pilote.wps[pilote.i] }
    if (!wp || t >= pilote.jusqua) { pilote = null; if (souris) { await p.mouse.up(); souris = false } }
    else {
      const dx = wp[0] - c.x, dy = wp[1] - c.y, L = Math.hypot(dx, dy)
      const ex = (dx / L) * pilote.v - c.vx, ey = (dy / L) * pilote.v - c.vy
      const E = Math.hypot(ex, ey)
      if (E > pilote.v * pilote.seuil) {
        const px = W / 2 + (c.x - c.cx) * c.z - (ex / E) * pilote.r, py = H / 2 - (c.y - c.cy) * c.z + (ey / E) * pilote.r
        await p.mouse.move(px, py)
        if (!souris) { await p.mouse.down(); souris = true; journal.push({ t, ejecte: 1 }) }
      } else if (souris) { await p.mouse.up(); souris = false }
    }
  }
  await stepGrab(p, `${dir}/f${String(f).padStart(5, '0')}.jpg`, fs, 1000 / fps)
  if (f % 5 === 0) { const c = await corps(); journal.push({ t, etat: c }); if (f % 30 === 0) process.stdout.write(`${sc.nom} ${f}/${N} n=${c.n}\n`) }
}
fs.writeFileSync(`${dir}/journal.json`, JSON.stringify(journal, null, 1))
await b.close()
