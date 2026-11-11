// L'HORLOGE PILOTÉE — injectée dans la page AVANT le premier script du jeu.
//
// POURQUOI. Sans carte graphique, le rendu d'une image en 1080×1920 prend
// environ 0,3 s (mesuré le 10/11/2026, Mesa llvmpipe, 4 cœurs). Filmer
// l'écran en temps réel donnerait trois images par seconde. On retourne le
// problème : le jeu ne voit plus l'horloge murale, il voit la NÔTRE. Chaque
// appel à __pas(16,67) lui fait croire qu'un soixantième de seconde s'est
// écoulé, on photographie l'image, et on recommence. La vidéo est à 60 i/s
// exactes quel que soit le temps que la machine a mis à les calculer.
//
// Le jeu s'y prête : son pas physique est fixe et son time warp ne touche
// jamais au pas (README), donc ce qu'on filme est la même simulation que
// celle du joueur, à l'image près.
//
// Quatre choses passent sous contrôle, parce que chacune a sa propre horloge :
//  1. performance.now / Date.now / requestAnimationFrame — la boucle d'images ;
//  2. setTimeout / setInterval — sinon un message prévu pour 2,6 s
//     disparaîtrait au bout de huit images filmées ;
//  3. les animations CSS — elles tournent sur l'horloge du compositeur, que
//     rien de ce qui précède ne touche : on les met en pause et on avance
//     leur currentTime à la main ;
//  4. le SON — voir plus bas, c'est le morceau qui vaut le détour.
(() => {
  const reglages = window.__clipReglages || {}
  let t = 1000
  const D0 = Date.now()
  const vraiNow = performance.now.bind(performance)
  window.__vraiNow = vraiNow
  performance.now = () => t
  Date.now = () => D0 + t

  // ---- 0. le hasard ---------------------------------------------------------
  // Math.random semé : deux exécutions du même scénario donnent la même
  // partie. C'est ce qui permet de régler un clip sur un APERÇU rapide en
  // petite taille, puis de le tourner en grand en sachant ce qu'on aura.
  let graine = (Number(reglages.graine) || 21) >>> 0
  // Le pilote RESSÈME au moment d'entrer en salle : le chargement de la page
  // dure un nombre d'images qui dépend de la machine, et chaque image tire
  // au sort — sans cela le corps ne naissait pas deux fois pareil (vécu le
  // 11/11 : l'écrasement arrivait sur l'îlot à y = +6 en aperçu, −17 en grand).
  window.__clipSeme = (g) => {
    graine = (Number(g) || 21) >>> 0
  }
  Math.random = () => {
    graine = (graine + 0x6d2b79f5) >>> 0
    let x = graine
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }

  // ---- 1. la boucle d'images ------------------------------------------------
  const images = new Map()
  let idImage = 0
  window.requestAnimationFrame = (f) => {
    images.set(++idImage, f)
    return idImage
  }
  window.cancelAnimationFrame = (i) => {
    images.delete(i)
  }

  // ---- 2. les minuteries ----------------------------------------------------
  const minuteries = new Map()
  let idMinuterie = 1e6 // loin des identifiants natifs : aucune collision
  const pose = (f, delai, args, periode) => {
    if (typeof f !== 'function') return 0
    const id = ++idMinuterie
    minuteries.set(id, { f, a: t + Math.max(0, Number(delai) || 0), args, periode })
    return id
  }
  window.setTimeout = (f, d, ...args) => pose(f, d, args, 0)
  window.setInterval = (f, d, ...args) => pose(f, d, args, Math.max(1, Number(d) || 0))
  const leve = (id) => {
    minuteries.delete(id)
  }
  window.clearTimeout = leve
  window.clearInterval = leve
  const sonneMinuteries = () => {
    // plusieurs tours : une minuterie échue peut en poser une autre, échue
    // elle aussi dans la même image (les chaînes de setTimeout(…, 0))
    for (let tour = 0; tour < 20; tour++) {
      const echues = [...minuteries.entries()].filter(([, m]) => m.a <= t).sort((x, y) => x[1].a - y[1].a)
      if (echues.length === 0) return
      for (const [id, m] of echues) {
        if (!minuteries.has(id)) continue
        if (m.periode > 0) m.a += m.periode
        else minuteries.delete(id)
        try {
          m.f(...m.args)
        } catch (e) {
          console.error('minuterie', (e && e.stack) || e)
        }
      }
    }
  }

  // ---- 3. les animations CSS ------------------------------------------------
  const vues = new WeakSet()
  const avanceAnimations = (dt) => {
    if (reglages.animations === false || !document.getAnimations) return
    for (const a of document.getAnimations()) {
      try {
        if (!vues.has(a)) {
          vues.add(a)
          a.pause()
        }
        const fin = a.effect ? a.effect.getComputedTiming().endTime : Infinity
        const suite = (Number(a.currentTime) || 0) + dt
        // une animation en pause ne se termine JAMAIS d'elle-même : sans ce
        // finish(), ni animationend ni transitionend ne partent, et tout ce
        // que le jeu attend d'eux (un voile qui se retire) resterait figé
        if (Number.isFinite(fin) && suite >= fin) a.finish()
        else a.currentTime = suite
      } catch {
        // une animation retirée entre-temps : sans gravité
      }
    }
  }

  // ---- 4. LE SON ------------------------------------------------------------
  // Le jeu synthétise presque tout en Web Audio. Un AudioContext ordinaire
  // tourne à l'heure murale : enregistré tel quel, le son d'une éjection
  // filmée à trois images par seconde tomberait cent images trop tôt.
  // On donne donc au jeu un OfflineAudioContext déguisé : il calcule le son
  // sans le jouer, et il sait s'ARRÊTER à un instant choisi (suspend(t)).
  // À chaque image, on le laisse avancer d'un soixantième de seconde, pas
  // plus. Le jeu lit ctx.currentTime, y programme ses notes, et le fichier
  // final est le vrai son du jeu, calé sur l'image à 3 ms près (un bloc de
  // 128 échantillons).
  const FREQ = 48000
  const BLOC = 128 / FREQ
  let ctxSon = null
  let renduSon = null
  let vraiSuspend = null
  let vraiResume = null
  let tSon0 = 0 // l'instant (ms, horloge pilotée) où le contexte est né
  let tamponSon = null
  const Natif = window.OfflineAudioContext
  if (Natif && reglages.son !== false) {
    const duree = Math.max(10, Number(reglages.dureeSon) || 150)
    const Faux = function () {
      if (ctxSon) return ctxSon
      const ctx = new Natif(2, Math.ceil(duree * FREQ), FREQ)
      vraiSuspend = ctx.suspend.bind(ctx)
      vraiResume = ctx.resume.bind(ctx)
      // le jeu réveille le contexte à chaque geste (« if suspended → resume ») :
      // obéir relancerait le calcul hors de notre cadence. Pour lui, le
      // contexte tourne, toujours.
      ctx.resume = () => Promise.resolve()
      ctx.suspend = () => Promise.resolve()
      ctx.close = () => Promise.resolve()
      Object.defineProperty(ctx, 'state', { get: () => 'running' })
      ctxSon = ctx
      tSon0 = t
      return ctx
    }
    window.AudioContext = Faux
    window.webkitAudioContext = Faux
  }
  const avanceSon = async () => {
    if (!ctxSon || tamponSon) return
    const cible = Math.floor((t - tSon0) / 1000 / BLOC) * BLOC
    if (cible <= ctxSon.currentTime + BLOC / 2 || cible >= ctxSon.length / FREQ - 1) return
    const arret = vraiSuspend(cible)
    if (!renduSon) {
      renduSon = ctxSon.startRendering()
      renduSon.then((b) => {
        tamponSon = b
      })
    } else void vraiResume()
    await arret
  }
  /** L'instant du son (s) qui correspond à MAINTENANT : le pilote le note au
   *  début et à la fin de l'enregistrement pour découper la piste. */
  window.__sonInstant = () => (ctxSon ? ctxSon.currentTime : -1)
  /** Termine le calcul et rend la tranche [debut, fin] en WAV 16 bits (base64). */
  window.__sonWav = async (debut, fin) => {
    if (!ctxSon || !renduSon) return null
    if (!tamponSon) {
      void vraiResume()
      await renduSon
    }
    const b = tamponSon
    const i0 = Math.max(0, Math.round(debut * FREQ))
    const i1 = Math.min(b.length, Math.round(fin * FREQ))
    const n = Math.max(0, i1 - i0)
    const g = b.getChannelData(0)
    const d = b.numberOfChannels > 1 ? b.getChannelData(1) : g
    const octets = new Uint8Array(44 + n * 4)
    const v = new DataView(octets.buffer)
    const ecrit = (o, s) => {
      for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
    }
    ecrit(0, 'RIFF')
    v.setUint32(4, 36 + n * 4, true)
    ecrit(8, 'WAVEfmt ')
    v.setUint32(16, 16, true)
    v.setUint16(20, 1, true)
    v.setUint16(22, 2, true)
    v.setUint32(24, FREQ, true)
    v.setUint32(28, FREQ * 4, true)
    v.setUint16(32, 4, true)
    v.setUint16(34, 16, true)
    ecrit(36, 'data')
    v.setUint32(40, n * 4, true)
    let crete = 0
    for (let i = 0; i < n; i++) {
      const a = Math.max(-1, Math.min(1, g[i0 + i]))
      const c = Math.max(-1, Math.min(1, d[i0 + i]))
      crete = Math.max(crete, Math.abs(a), Math.abs(c))
      v.setInt16(44 + i * 4, Math.round(a * 32767), true)
      v.setInt16(46 + i * 4, Math.round(c * 32767), true)
    }
    let s = ''
    for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000))
    return { base64: btoa(s), crete, secondes: n / FREQ }
  }

  // ---- le pas ---------------------------------------------------------------
  window.__pas = async (dt) => {
    t += dt
    sonneMinuteries()
    avanceAnimations(dt)
    await avanceSon()
    const lot = [...images.values()]
    images.clear()
    for (const f of lot) {
      try {
        f(t)
      } catch (e) {
        console.error('image', (e && e.stack) || e)
      }
    }
    return lot.length
  }
  window.__t = () => t
})()
