// LES POSES DE LA CÉRÉMONIE — le DOM que main.ts bâtit à chaque étape,
// recopié de ses gabarits (références main.ts:ligne en tête de chaque pose),
// rempli de valeurs plausibles. S'appuie sur window.FAB (fabrique.js).
;(() => {
  const F = window.FAB
  const $ = (id) => document.getElementById(id)
  const veil = $('mb-veil')
  const scene = $('mb-scene')
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const fmtL = (l) => `${l.toFixed(2).replace('.', ',')} L`
  const fmtTime = (s) => `${s.toFixed(1).replace('.', ',')} s`
  const virgule = (n, d = 2) => n.toFixed(d).replace('.', ',')
  const MB_OR = ['#ffd977', '#ffe9a8', '#fff4d6', '#f2c98e']
  const MB_MENTHE = ['#6dffb8', '#a9ffd6', '#8fd8c8', '#eaf6ff']
  const MB_EAU = ['#63b7e6', '#a7ddf5', '#eaf6ff', '#4fa8d8']
  const PALIERS = [3, 6, 10, 15, 21, 28, 36]
  const paliers = (xp) => PALIERS.filter((p) => xp >= p).length
  const segment = (xp) => { let base = 0; for (const p of PALIERS) { if (xp >= p) base = p; else return { base, cible: p } } return { base, cible: null } }

  // ---- LA RUN DU BANC (valeurs plausibles, pas mesurées) ----
  const RUN = {
    code: 'G-203-K3F9', pct: 0.93, surplus: 4.18, prime: 0.32, temps: 48.3,
    newVolume: true, newChrono: false, recChr: '41,6 s · OPÉRATEUR',
    bonbonne: 3.2, cap: 8, xp: 4.6, condensat: 655, memoireSolde: 148,
    module: 'TRANSFO GLACE', rang: 3, longueur: 18,
  }

  // ---- le feu : la vraie simulation (ceremonieFx.Feu), avancée à la main ----
  function feu(rafales) {
    const c = $('mb-feu')
    c.width = veil.clientWidth; c.height = veil.clientHeight
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    const v = veil.getBoundingClientRect()
    rafales.forEach(({ el, r, age }, k) => {
      if (!el) return
      const b = el.getBoundingClientRect()
      const f = new F.Feu()
      f.eclate(b.left + b.width / 2 - v.left, b.top + b.height / 2 - v.top, r, F.graine(31 + k * 7))
      for (let t = 0; t < age; t += 1 / 60) f.pas(1 / 60)
      f.dessine(ctx)
    })
  }

  // ---- figer les animations CSS à un instant donné (ms depuis leur départ) ----
  function fige(regles, defaut) {
    for (const a of document.getAnimations()) {
      const cible = a.effect && a.effect.target
      let ms = defaut
      for (const [sel, t] of regles) if (cible && cible.matches && cible.matches(sel)) { ms = t; break }
      a.pause()
      if (ms !== null) a.currentTime = ms
    }
  }

  function ouvre() {
    veil.hidden = false
    veil.style.zIndex = '2147483647'
    scene.classList.remove('mb-compact', 'mb-large', 'mb-secousse', 'mb-question')
    $('mb-palier-eclair').hidden = true
    $('mb-flash').classList.remove('mb-on')
    const c = $('mb-feu'); c.width = veil.clientWidth; c.height = veil.clientHeight
  }
  function cartes() { // main.ts:15489 mbCartes
    const h = $('mb-cartes')
    h.className = 'mb-cartes'
    h.style.removeProperty('--n')
    h.innerHTML = ''
    $('mb-choix-titre').classList.remove('mb-grande')
    scene.classList.remove('mb-question')
    return h
  }
  function question(t) { // main.ts:16613 mbQuestion
    $('mb-titre').textContent = t
    scene.classList.add('mb-question')
    $('mb-choix-titre').classList.remove('mb-grande')
  }

  // main.ts mbPoseCuve : une image en échec se cache (jamais l'icône d'image
  // cassée), le dos chargé efface la silhouette d'attente
  function poseCuve(hote, html) {
    hote.innerHTML = html
    const cuve = hote.querySelector('.mb-cuve')
    for (const img of hote.querySelectorAll('img')) {
      const echoue = () => { img.hidden = true }
      const charge = () => { if (img.classList.contains('mb-cuve-dos')) cuve.classList.add('mb-cuve-rendue') }
      if (img.complete) { if (img.naturalWidth === 0) echoue(); else charge() }
      else { img.addEventListener('error', echoue, { once: true }); img.addEventListener('load', charge, { once: true }) }
    }
    return hote.querySelector('.mb-cuve-liquide')
  }

  // ---- LE BILAN (main.ts montreMiseEnBonbonne, mbFigeBilan) ----
  // la scène « station » : la poutre, le sceau du rang, la bonbonne cerclée
  // de son manomètre, le volume, la ligne chrono · note (ou le tampon
  // RECORD), les cartouches, le levier
  function bilan(etat) {
    ouvre()
    scene.scrollTop = 0
    const v = F.rangDeSalle(RUN.pct)
    const part = Math.max(0, Math.min(1, RUN.pct))
    veil.style.setProperty('--mb-rang', v.teinte)
    $('mb-releve').hidden = false
    $('mb-titre').textContent = 'SALLE FRANCHIE'
    $('mb-sur').textContent = `MISE EN BONBONNE · ${RUN.code} · PRIME : TIRAGE GARANTI`
    const rang = $('mb-rang')
    rang.hidden = true
    rang.title = `${v.nom} — ${v.mot}`
    $('mb-rang-img').innerHTML = F.sceauHTML(v.rang)
    $('mb-rang-lettre').textContent = v.nom
    $('mb-rang-lettre').style.setProperty('--mb-nom-n', String(v.nom.length))
    $('mb-etoiles').innerHTML = '<i>★</i>'.repeat(5)
    const eau = poseCuve($('mb-bonbonne'), F.cuveHTML('bonbonne', 'mb-eau'))
    $('mb-mano').style.setProperty('--mb-mano-p', '0')
    $('mb-part').textContent = '0 %'
    $('mb-l').textContent = '0,00 L'
    $('mb-prime').hidden = true; $('mb-verse').hidden = true
    $('mb-choix').hidden = true
    // main.ts : la ligne chrono · note, ou le tampon d'un record
    const note = Math.round((RUN.surplus * 100 * 60) / (60 + RUN.temps))
    const record = RUN.newVolume || RUN.newChrono
    const quoi = [RUN.newVolume ? 'volume' : '', RUN.newChrono ? 'chrono' : ''].filter((x) => x).join(' et ')
    const ligne = $('mb-ligne')
    ligne.classList.remove('mb-on')
    ligne.innerHTML = record
      ? `<em class="mb-record" title="${esc(`record du protocole : ${quoi}`)}">RECORD` +
        (RUN.newChrono ? `${F.iconeCeremonieHTML('chrono')}<b>${fmtTime(RUN.temps)}</b>` : '') + `</em>`
      : `<span class="mb-ligne-it" title="${esc(`chrono — record ${RUN.recChr}`)}">${F.iconeCeremonieHTML('chrono')}<b>${fmtTime(RUN.temps)}</b></span>` +
        `<span class="mb-ligne-it" title="${esc(`note — ${F.motDeNote(note)}, le volume pesé par la vitesse`)}">${F.iconeCeremonieHTML('note')}<b>${note}</b></span>`
    const cond = F.condensatDuSas({ surplusL: RUN.surplus, rendement: 1, primeDouble: false, pastillesCl: 35 })
    const mem = F.memoireDuSas({ premiereFois: true, newVolume: true, newChrono: false, primeMur: 0, facteurModule: 1, primeDouble: false })
    const gains = F.gainsDeSalle({
      condensat: cond, bourseCl: RUN.condensat, memoire: mem.brut, memoireDetail: mem.detail,
      memoireSolde: RUN.memoireSolde, tirageGaranti: true, orbe: null,
    })
    RUN.gains = gains
    $('mb-gains').innerHTML = gains.map(F.cartoucheHTML).join('')
    $('mb-etal').hidden = true
    $('mb-etal').classList.remove('coule', 'mb-mince')
    $('mb-etal-tampon').hidden = true
    $('mb-etal-gain').hidden = true
    $('mb-passer').hidden = false
    $('mb-passer').focus({ preventScroll: true })
    if (etat === 'chute') {
      // t ≈ 850 ms : le sceau vient de tomber (TEMPS_BILAN.rang = 650), la
      // bonbonne attend encore, vide
      rang.hidden = false
      $('mb-flash').classList.add('mb-on')
      scene.classList.add('mb-secousse')
      return v
    }
    // état final (≈ 4,6 s) : ce que mbFigeBilan écrit
    rang.hidden = false
    Array.from($('mb-etoiles').children).forEach((e, i) => { if (i < v.etoiles) e.classList.add('mb-on') })
    eau.style.setProperty('--mb-niveau', part.toFixed(3))
    $('mb-mano').style.setProperty('--mb-mano-p', part.toFixed(3))
    $('mb-part').textContent = `${Math.round(RUN.pct * 100)} %`
    $('mb-l').textContent = fmtL(RUN.surplus)
    $('mb-prime').hidden = false
    $('mb-prime').textContent = `dont +${fmtL(RUN.prime)} de PRIME DE GLACE`
    ligne.classList.add('mb-on')
    for (const c of $('mb-gains').children) c.classList.add('mb-on')
    return v
  }

  // ---- LE VOCABULAIRE DE LA STATION : les primitives seules, sur la vraie
  // feuille, avant qu'une étape ne les emploie. Ce n'est PAS un gabarit de
  // main.ts mais un nuancier : chaque primitive, et l'état qu'il faut voir
  // (rangs S A D, focus de la manette, manomètre plein et vide). Les images
  // rendues manquent tant que le lot Blender n'a pas livré : on doit alors
  // lire les fonds propres (alvéoles, octogones), jamais un trou. ----
  function vocabulaire() {
    ouvre()
    for (const e of scene.children) e.style.display = 'none'
    const mano = (p) =>
      `<svg class="mb-mano" viewBox="0 0 100 100" aria-hidden="true" style="--mb-mano-p:${p};width:150px;height:150px">` +
      `<path class="mb-mano-piste" pathLength="1" d="M18.89 81.11A44 44 0 1 1 81.11 81.11"/>` +
      `<path class="mb-mano-grad" pathLength="1" d="M24.54 75.46A36 36 0 1 1 75.46 75.46"/>` +
      `<path class="mb-mano-arc" pathLength="1" d="M18.89 81.11A44 44 0 1 1 81.11 81.11"/></svg>`
    const sceau = (r, teinte, mot) =>
      `<div class="mb-sceau" style="--mb-rang:${teinte};--mb-nom-n:${mot.length}">${F.sceauHTML(r)}<b class="mb-sceau-mot">${mot}</b></div>`
    const cartouche = (cle, val, nom, teinte) =>
      `<div class="mb-cartouche" style="--mb-liseret:${teinte}"><span class="mb-cartouche-alv">${F.iconeCeremonieHTML(cle)}</span>` +
      `<b class="mb-cartouche-val">${val}</b><span class="mb-cartouche-nom">${nom}</span></div>`
    const n = document.createElement('div')
    n.style.cssText = 'display:flex;flex-direction:column;gap:18px;align-items:center'
    n.innerHTML =
      `<div class="mb-poutre" style="width:72%"><b style="font-size:24px;letter-spacing:.3em;font-weight:400">SALLE FRANCHIE</b></div>` +
      `<div style="display:flex;gap:26px;align-items:center">` +
        sceau('S', '#ffd977', 'SUPERFLUIDE') + sceau('B', '#63b7e6', 'TURBULENT') + sceau('D', '#e0685c', 'FIGÉ') +
        mano(RUN.pct) + mano(0) +
      `</div>` +
      `<div style="display:grid;grid-template-columns:repeat(3,220px);gap:16px">` +
        cartouche('condensat', '+453 cL', 'Condensat', 'var(--mb-teal)') +
        cartouche('memoire', '+12', 'Mémoire', '#b9a4ff') +
        cartouche('tirage', '+1', 'Tirage', 'var(--mb-or)') +
      `</div>` +
      `<div style="display:flex;gap:16px;align-items:stretch">` +
        `<div class="mb-coupe" style="width:180px;height:90px;display:grid;place-items:center">.mb-coupe</div>` +
        `<div class="mb-coupe-diag" style="width:180px;height:90px;display:grid;place-items:center">.mb-coupe-diag</div>` +
        `<div style="display:flex;flex-direction:column;gap:10px;justify-content:center">` +
          `<button type="button" class="mb-levier">PASSER ▸</button>` +
          `<button type="button" class="mb-levier pad-focus">VISÉ (MANETTE)</button>` +
        `</div>` +
      `</div>`
    scene.appendChild(n)
  }

  // ---- LE VERSEMENT (main.ts:15132 mbMontreVersement) ----
  // le bilan s'en va, la poutre pose la question ; deux cuves rendues de
  // part et d'autre de l'orbe, un chiffre chacune, les anneaux sur la colonne
  function versement() {
    bilan('final')
    $('mb-passer').hidden = true // mbFigeBilan
    const host = cartes()
    host.innerHTML = ''
    scene.classList.add('mb-compact')
    $('mb-releve').hidden = true
    $('mb-titre').textContent = 'OÙ VERSER LE SURPLUS ?'
    $('mb-choix').hidden = false
    $('mb-choix-titre').textContent = `SALLE FRANCHIE · ${RUN.code} · ${F.rangDeSalle(RUN.pct).nom}`
    const b = RUN, cap = RUN.cap
    const espace = Math.max(0, cap - b.bonbonne), verse = Math.min(b.surplus, espace), spill = b.surplus - verse
    const pleine = espace < 0.01
    const prochain = segment(b.xp).cible
    const franchit = prochain !== null && b.xp + b.surplus >= prochain
    const fmt = (l) => l.toFixed(2).replace('.', ',')
    const borne = (v) => Math.max(0, Math.min(1, v))
    const sc = document.createElement('div'); sc.className = 'mb-versement'
    const goutte = document.createElement('div'); goutte.className = 'mb-goutte'
    goutte.innerHTML = `<span class="mb-flux mb-flux-g" aria-hidden="true"></span>` +
      `<span class="mb-flux mb-flux-d" aria-hidden="true"></span>` +
      `<span class="mb-goutte-corps"><b>${fmt(b.surplus)} L</b><i>SURPLUS</i></span>`
    const cuve = (o, html, i, niveau, apres, chiffre, pied, titre) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `mb-dest mb-coupe-diag mb-dest-${o}`
      btn.style.setProperty('--i', String(i))
      btn.title = titre
      btn.innerHTML = `<b class="mb-dest-nom">${o === 'reserve' ? 'RÉSERVE' : 'MAÎTRISE'}</b>` +
        `<span class="mb-dest-cuve"></span>` +
        `<b class="mb-dest-val">${chiffre}</b>` + pied
      const liquide = poseCuve(btn.querySelector('.mb-dest-cuve'), html)
      liquide.style.setProperty('--mb-niveau', niveau.toFixed(3))
      liquide.style.setProperty('--mb-avant', niveau.toFixed(3))
      liquide.style.setProperty('--mb-apres', apres.toFixed(3))
      return { btn, liquide }
    }
    const res = cuve('reserve', F.cuveHTML('reserve', 'mb-v-res'), 0,
      borne(b.bonbonne / Math.max(0.01, cap)), borne((b.bonbonne + verse) / Math.max(0.01, cap)),
      pleine ? 'PLEINE' : `${fmt(b.bonbonne + verse)} L`,
      !pleine && spill > 0.01 ? `<em class="mb-dest-plus">+${fmt(spill)} L → MAÎTRISE</em>` : '',
      pleine
        ? `Réserve pleine (${cap} / ${cap} L) — tout le surplus ira à la maîtrise`
        : `Réserve : ${fmt(b.bonbonne)} → ${fmt(b.bonbonne + verse)} L sur ${cap} L — à reverser dans le corps, en pleine salle` +
          (spill > 0.01 ? ` ; ${fmt(spill)} L d’excédent vers la maîtrise` : ''))
    if (pleine) { res.btn.classList.add('mb-pauvre'); res.btn.disabled = true }
    const col = F.colonneMaitrise(b.xp)
    const mai = cuve('maitrise', F.cuveHTML('maitrise', 'mb-v-mai'), 1,
      F.niveauColonne(col, b.xp), F.niveauColonne(col, b.xp + b.surplus),
      `${virgule(b.xp + b.surplus, 1)} L`,
      franchit ? `<em class="mb-dest-plus mb-dest-ouvre">UN PALIER SE FRANCHIT — TIRAGE OUVERT</em>` : '',
      `Maîtrise : ${virgule(b.xp, 1)} → ${virgule(b.xp + b.surplus, 1)} L` +
        (prochain !== null ? `, palier à ${prochain} L` : ', table complète') +
        ' — chaque palier ouvre un tirage d’instrument')
    if (franchit) mai.btn.classList.add('mb-dest-palier')
    mai.btn.querySelector('.mb-cuve').insertAdjacentHTML('beforeend', F.anneauxHTML(col, b.xp, b.xp + b.surplus))
    sc.append(res.btn, goutte, mai.btn)
    host.appendChild(sc)
  }

  // ---- la jauge (main.ts:15201 mbPeintEtal) ----
  function peintEtal(xp) {
    const seg = segment(xp)
    const part = seg.cible === null ? 1 : Math.max(0, Math.min(1, (xp - seg.base) / (seg.cible - seg.base)))
    const pct = `${(part * 100).toFixed(2)}%`
    $('mb-etal-fluide').style.width = pct
    $('mb-etal-lueur').style.left = pct
    $('mb-etal-l').textContent = virgule(xp, 1)
    $('mb-etal-pg').querySelector('b').textContent = String(paliers(xp))
    $('mb-etal-pd').querySelector('b').textContent = seg.cible === null ? '★' : `${seg.cible} L`
    $('mb-etal-pd').querySelector('small').textContent = seg.cible === null ? 'complet' : 'prochain'
  }
  // le bandeau replié : versé à la maîtrise (main.ts:15462 mbVerseXp)
  function bandeau() {
    bilan('final')
    $('mb-passer').hidden = true
    $('mb-choix').hidden = false
    const v = $('mb-verse'); v.textContent = '→ versé à la maîtrise'; v.hidden = false
    scene.classList.add('mb-compact')
  }

  // ---- L'ÉTALONNAGE, au palier franchi (main.ts:15359 mbAnimeEtalonnage) ----
  function etalonnage(etat) {
    bandeau()
    $('mb-choix-titre').textContent = 'LA MAÎTRISE MONTE'
    cartes()
    const etal = $('mb-etal')
    etal.hidden = false
    etal.classList.remove('mb-mince')
    $('mb-etal-gain').hidden = false
    $('mb-etal-gain').textContent = `+${virgule(RUN.surplus, 2)} L`
    const no = paliers(6)
    if (etat === 'palier') {
      etal.classList.add('coule')
      $('mb-etal-tube').classList.add('eclair')
      $('mb-etal-pg').classList.add('saute')
      const t = $('mb-etal-tampon'); t.hidden = false; t.textContent = `PALIER ${no} — TIRAGE OUVERT`
      $('mb-palier-eclair-no').textContent = `PALIER ${no}`
      $('mb-palier-eclair').hidden = false
      $('mb-flash').classList.add('mb-on')
      scene.classList.add('mb-secousse')
      peintEtal(6)
      return
    }
    // la coulée finie : le second segment rempli
    const t = $('mb-etal-tampon'); t.hidden = false; t.textContent = `PALIER ${no} — TIRAGE OUVERT`
    peintEtal(RUN.xp + RUN.surplus)
  }

  // ---- LE TIRAGE (main.ts:15502 mbMontreDraft) ----
  function draft(etat) {
    etalonnage('fin')
    const xpF = RUN.xp + RUN.surplus
    $('mb-choix-titre').textContent = `${F.titreDuTirage(paliers(xpF), 2, true)} · EN BOURSE : ${RUN.condensat} cL`
    const host = cartes()
    const tir = F.tirageInstruments(F.graine(5), [], 2, 3, 3, F.INSTRUMENTS)
    host.classList.add('mb-draft')
    host.style.setProperty('--n', String(Math.min(4, tir.length)))
    tir.forEach((c, i) => {
      const def = F.INSTRUMENTS.find((d) => d.id === c.id)
      const pli = document.createElement('div')
      pli.className = 'mb-pli'
      pli.style.setProperty('--i', String(i))
      pli.innerHTML = F.carteHTML(def, { variante: 'draft', bouton: true, prix: c.prix })
      const btn = pli.firstElementChild
      btn.style.setProperty('--i', String(i))
      if (!(c.prix === 0 || RUN.condensat >= c.prix)) { btn.classList.add('mb-pauvre'); btn.disabled = true }
      host.appendChild(pli)
    })
    if (etat === 'elue') {
      host.classList.add('mb-elu')
      host.children[1].classList.add('mb-elu-c')
      scene.classList.add('mb-secousse')
    }
  }

  // ---- LE CHOIX DE LA SALLE (main.ts mbMontreSallesVoie, mbPorte, mbPorteNoeud) ----
  function salles(variante) {
    ouvre()
    $('mb-releve').hidden = true
    $('mb-etal').hidden = true
    $('mb-passer').hidden = true
    $('mb-choix').hidden = false
    $('mb-choix-titre').textContent = `${RUN.module} · SALLE 3/6 · DESCENTE ${RUN.rang + 1}/${RUN.longueur}`
    scene.classList.add('mb-compact')
    const host = cartes()
    question('CHOISISSEZ LA SALLE SUIVANTE') // après le porte-cartes, comme main.ts
    host.classList.add('mb-trio')
    host.innerHTML = `<div class="mb-voies">${F.miniCarte()}<p class="mv-fiche" hidden></p></div>`
    const REP = [['▲', 'HAUT'], ['●', 'MILIEU'], ['▼', 'BAS']]
    const portes = [
      { mec: 0, diff: 3, v: 'K3F9', figure: 'le serpentin' },
      { mec: 1, diff: 4, v: 'PQ2Z', prime: 'CONDENSAT ×2' },
      variante === 'noeud' ? { noeud: true } : { mec: 2, diff: 3, v: 'AB12' },
    ]
    portes.forEach((p, i) => {
      const no = `<span class="mb-porte-no mb-porte-repere"><i>${REP[i][0]}</i> VOIE DU ${REP[i][1]}</span>`
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.style.setProperty('--i', String(i))
      if (p.noeud) {
        btn.className = 'mb-porte mb-coupe mb-porte-ev mb-porte-evenement'
        btn.innerHTML = `<span class="mb-porte-vue mb-ev-vue">${no}<span class="mb-ev-objet">${F.iconeCeremonieHTML('rencontre')}</span><span class="mb-porte-entrer mb-levier">ENTRER ▸</span></span>` +
          `<b>SIGNAL</b><small>Quelque chose vit encore derrière.</small><span class="mb-porte-ligne mb-porte-ligne-ev"><i>RENCONTRE</i></span>`
      } else {
        btn.className = 'mb-porte mb-coupe'
        btn.innerHTML = `<span class="mb-porte-vue">${no}<canvas width="440" height="252"></canvas><span class="mb-porte-entrer mb-levier">ENTRER ▸</span></span><b></b><small></small><span class="mb-porte-ligne"></span>`
        const [code, nom] = F.plan(btn.querySelector('canvas'), p.mec, p.diff, p.v).split('|')
        btn.querySelector('b').textContent = code
        btn.querySelector('small').textContent = nom
        btn.querySelector('.mb-porte-ligne').innerHTML = [`<i>DIFF ${p.diff}</i>`, p.prime ? `<i class="mb-porte-prime">PRIME ${p.prime}</i>` : '', p.figure ? `<i>FIGURE ${p.figure.toUpperCase()}</i>` : ''].join('')
      }
      host.appendChild(btn)
    })
  }

  // ---- LE BILAN DU MODULE (main.ts:15400 mbMontreBilanModule) ----
  // la scène « station » : le sceau du module en héros, le nom, le volume ;
  // la rangée des petits sceaux de rang (SIX salles : le plus long module de
  // carteStation.json, le pire cas de la rangée) ; les cartouches ; le levier
  function module(etat) {
    ouvre()
    scene.classList.add('mb-compact')
    $('mb-releve').hidden = true
    $('mb-choix-titre').textContent = `DESCENTE 6 / ${RUN.longueur} · CE QUE LE MODULE A RENDU`
    $('mb-etal').hidden = true; $('mb-passer').hidden = true; $('mb-choix').hidden = false
    const host = cartes()
    question('MODULE TRAVERSÉ')
    const r = {
      module: 'T1', haltes: 1, condensatCl: 1235, memoire: 22, orbes: [], instrumentsEntree: [], paliersEntree: 1,
      salles: [
        { code: 'G-102-AB12', pct: 0.93, litres: 4.18 }, { code: '21B7-031', pct: 0.78, litres: 3.4 },
        { code: 'G-213-K3F9', pct: 0.55, litres: 2.31 }, { code: 'G-221-PQ2Z', pct: 0.95, litres: 4.6 },
        { code: 'G-232-ZZ01', pct: 0.34, litres: 1.42 }, { code: 'G-240-QX7M', pct: 0.12, litres: 0.48 },
      ],
    }
    const gains = F.gainsDeModule({
      recolte: r, bourseCl: 1890, memoireSolde: 164, instruments: ['aimant-rosee', 'croc-du-sas'],
      nomInstrument: (id) => { const d = F.INSTRUMENTS.find((x) => x.id === id); return d ? { icone: d.icone, nom: d.nom } : null },
      paliers: 2,
    })
    const livre = gains.find((g) => g.cle === 'livre')
    const sous = ['énigme', '6 salles franchies', '1 rencontre ou halte']
    const bloc = document.createElement('div')
    bloc.className = 'mb-module'
    bloc.innerHTML =
      `<div class="mb-module-sceau mb-sceau">${F.sceauHTML('module')}</div>` +
      `<div class="mb-module-nom"><b>${esc(RUN.module)}</b><small>${esc(sous.join(' · '))}</small></div>` +
      `<div class="mb-module-total"><small>${esc(livre.nom)}</small><b>${esc(livre.valeur)}</b></div>` +
      `<ol class="mb-module-salles" aria-label="Les salles franchies">` +
      F.pastillesDeSalles(r).map((p, i) =>
        `<li class="mb-salle" style="--mb-rang:${p.teinte};--i:${i}" title="${esc(p.nom)}">` +
        `<span class="mb-salle-sceau mb-sceau" role="img" aria-label="${esc(p.nom)}">${F.sceauHTML(p.rang)}</span>` +
        `<span class="mb-salle-code">${esc(p.code)}</span><b class="mb-salle-l">${p.litres}</b></li>`).join('') +
      `</ol>` +
      `<div class="mb-gains">${gains.filter((g) => g !== livre).map((g, i) => F.cartoucheHTML(g, i)).join('')}</div>`
    host.appendChild(bloc)
    const btn = document.createElement('button')
    btn.type = 'button'; btn.className = 'mb-levier mb-module-levier'; btn.textContent = 'CHOISIR LA COURSIVE SUIVANTE ▸'
    host.appendChild(btn)
  }

  // ---- LA CARTE DE LA STATION (main.ts mbMontreCarte) ----
  function carte() {
    ouvre()
    scene.classList.add('mb-compact')
    $('mb-releve').hidden = true; $('mb-etal').hidden = true; $('mb-passer').hidden = true; $('mb-choix').hidden = false
    scene.classList.add('mb-large')
    const st = F.station()
    $('mb-choix-titre').textContent = `${st.nomCourant} TRAVERSÉ — CHOISISSEZ LA COURSIVE SUIVANTE`
    const host = cartes()
    question('CHOISISSEZ LA COURSIVE') // après le porte-cartes, comme main.ts
    host.classList.add('mb-station')
    const sc = document.createElement('div')
    sc.className = 'mb-station-carte mb-coupe'
    sc.style.setProperty('--cadre', st.cadre)
    sc.innerHTML = st.svg
    host.appendChild(sc)
    const lg = document.createElement('ul'); lg.className = 'mb-station-legende'; lg.innerHTML = st.legende
    host.appendChild(lg)
    const fiche = document.createElement('p'); fiche.className = 'mb-station-fiche'
    fiche.innerHTML = [`${st.choix.length} coursives ouvertes · descente 6 / ${RUN.longueur} salles`,
      'visez un module allumé : ce qu’on y trouve, et la route la plus courte jusqu’à l’objectif se trace en blanc sur le plan',
      'ce qui s’éteint alors ne sera plus joignable par là — c’est ce que ce choix ferme'].map((t) => `<span>${esc(t)}</span>`).join('')
    host.appendChild(fiche)
  }

  // ---- HALTES (main.ts mbMontreRepos, mbMontreDon, mbMontreCache) ----
  // la scène « station » : l'objet rendu en héros, les offres en
  // cartouches (le glyphe des données par ICONE_DE_GLYPHE), un levier
  function halteBase(q, titre) {
    ouvre(); scene.classList.add('mb-compact')
    $('mb-releve').hidden = true; $('mb-etal').hidden = true; $('mb-passer').hidden = true; $('mb-choix').hidden = false
    $('mb-choix-titre').textContent = titre
    const host = cartes()
    question(q) // après le porte-cartes, comme main.ts
    return host
  }
  function halte(host, icone, recit) {
    const h = document.createElement('div')
    h.className = recit ? 'mb-halte mb-halte-a-recit' : 'mb-halte'
    h.innerHTML = `<div class="mb-halte-heros">${F.iconeCeremonieHTML(icone)}</div>`
    host.appendChild(h)
    return h
  }
  function rangee(h) {
    const r = document.createElement('div'); r.className = 'mb-halte-offres'; h.appendChild(r); return r
  }
  function levier(h, texte) {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mb-levier mb-halte-levier'; btn.textContent = texte
    h.appendChild(btn)
    return btn
  }
  function repos() {
    const host = halteBase('REPOS', `${RUN.module} — UNE SEULE OFFRE`)
    const r = rangee(halte(host, 'repos'))
    F.offresRepos({ vies: 2, viesMax: 3, bonbonne: RUN.bonbonne, cap: RUN.cap }).forEach((o, i) => {
      const b = document.createElement('button'); b.type = 'button'
      b.className = `mb-cartouche mb-offre mb-cartouche-${F.iconeDuGlyphe(o.icone) ?? 'offre'}` + (o.possible ? '' : ' mb-pauvre')
      b.disabled = !o.possible
      b.style.setProperty('--i', String(i))
      b.innerHTML = F.offreHTML({ glyphe: o.icone, nom: o.nom, detail: o.detail })
      r.appendChild(b)
    })
  }
  function don() {
    const host = halteBase('UNE HALTE — PRENEZ', `${RUN.module} — QUELQU’UN A LAISSÉ ÇA LÀ`)
    const o = F.offreDon({ bonbonne: RUN.bonbonne, cap: RUN.cap })
    const b = document.createElement('button'); b.type = 'button'
    b.className = `mb-cartouche mb-offre mb-cartouche-${F.iconeDuGlyphe(o.icone) ?? 'offre'}`
    b.innerHTML = F.offreHTML({ glyphe: o.icone, nom: o.nom, detail: o.detail })
    rangee(halte(host, 'don')).appendChild(b)
  }
  function cache() {
    const host = halteBase('LA CACHE', 'SOUTES — UNE CHAMBRE CLOSE')
    const nom = F.ORBES[0].nom
    const h = halte(host, 'cache', true)
    h.insertAdjacentHTML('beforeend',
      `<div class="mb-ev-recit mb-ev-issue mb-coupe-diag"><em>SOUTES</em><p>${esc(`L’orbe d’essence de conscience — ${nom}. Il vous suit.`)}</p></div>` +
      `<div class="mb-halte-puces">${F.plaqueHTML({ cle: 'orbe', icone: 'orbe', valeur: nom, nom: 'ORBE D’ESSENCE' }, 0)}</div>`)
    levier(h, 'REPRENDRE LA DESCENTE ▸')
  }

  // ---- LA RENCONTRE (main.ts mbPeintEvenement, mbTranche) ----
  function ligneEffet(e) { // main.ts appliqueEffets, au format affiché
    switch (e.quoi) {
      case 'bonbonne': return `🫙 réserve ${e.litres >= 0 ? '+' : ''}${virgule(e.litres, 1)} L`
      case 'condensat': return `💧 condensat ${e.cl >= 0 ? '+' : ''}${Math.round(e.cl)} cL`
      case 'memoire': return `🧠 mémoire +${Math.round(e.n)}`
      case 'vies': return `💠 ${e.n > 0 ? '+' : ''}${e.n} échantillon de secours`
      case 'essence': return `🜄 essence maximale ${Math.round(e.part * 100)} % — le corps naîtra à ${Math.round((1 + e.part) * 100)} % du plein`
      case 'confinement': return `⚠️ confinement +${e.crans} à la prochaine salle`
      case 'instrument': { const d = F.INSTRUMENTS.find((x) => x.id === 'aimant-rosee'); return `${d.icone} ${d.nom} : ${d.desc}` }
      default: return F.ditEffet(e)
    }
  }
  // l'émoji d'un instrument : sa case rendue, retrouvée par son nom (main.ts mbTranche)
  function instrument(glyphe, texte) {
    const d = F.INSTRUMENTS.find((x) => x.icone === glyphe && texte.includes(x.nom))
    return d ? F.iconeInstrumentHTML(d) : null
  }
  function evenement(etat) {
    const ev = F.tireEvenement([], F.graine(11))
    const host = halteBase(ev.titre, `${RUN.module} — RENCONTRE · DESCENTE ${RUN.rang + 1} / ${RUN.longueur}`)
    const h = halte(host, 'rencontre', true)
    if (etat === 'issue') {
      const choix = ev.choix[0]
      const issue = F.resoutChoix(choix, F.graine(3))
      // l'issue tirée, et une ligne d'instrument et une ligne de glyphe
      // inconnu de plus : le banc montre les trois sortes de puce
      const lignes = [...issue.effets.map(ligneEffet).filter(Boolean), ligneEffet({ quoi: 'instrument', bon: true }), '🧪 un glyphe que la table ne connaît pas']
      h.insertAdjacentHTML('beforeend',
        `<div class="mb-ev-recit mb-ev-issue mb-coupe-diag"><em>${esc(choix.libelle)} — ${esc(choix.detail)}</em><p>${esc(issue.texte)}</p></div>` +
        `<ul class="mb-halte-puces">${lignes.map((l, i) => F.puceHTML(l, i, instrument)).join('')}</ul>`)
      levier(h, 'REPRENDRE LA DESCENTE ▸')
      return
    }
    const rc = document.createElement('div'); rc.className = 'mb-ev-recit mb-coupe-diag'
    rc.innerHTML = `<em>${esc(ev.lieu)}</em><p>${esc(ev.texte)}</p>`
    h.appendChild(rc)
    const r = rangee(h)
    const etatJ = { bonbonne: RUN.bonbonne, cap: RUN.cap, vies: 2, viesMax: 3, essence: 1, plancher: 0.5, orbeAPrendre: true, inconnuALire: true }
    F.offresDe(ev, etatJ).forEach(({ choix, possible }, i) => {
      const b = document.createElement('button'); b.type = 'button'
      b.className = 'mb-cartouche mb-offre' + (possible ? '' : ' mb-pauvre'); b.disabled = !possible
      b.style.setProperty('--i', String(i))
      const d = F.detailOffre(choix, i === 0, possible)
      b.innerHTML = F.offreHTML({
        nom: choix.libelle, detail: d.texte, voile: d.voilee,
        mention: choix.issues.length > 1 ? `<em class="mb-ev-pari">⚄ ${choix.issues.length} issues possibles</em>` : `<em class="mb-ev-sur">▸ sans risque</em>`,
      })
      r.appendChild(b)
    })
  }

  // ---- LE RÉSULTAT D'UN MINI-JEU (main.ts mbMontreResultatMiniJeu) ----
  function minijeu() {
    const host = halteBase('LES RAFALES', '3,62 L À L\'ARRIVÉE SUR 4,50 L AU DÉPART — 80 % GARDÉS, EN 21,4 S')
    const h = halte(host, 'rafales')
    h.insertAdjacentHTML('beforeend', `<b class="mb-halte-verdict">ÉCORNÉ</b>` +
      `<div class="mb-halte-puces">${F.plaqueHTML({ cle: 'memoire', icone: 'memoire', valeur: '+6', nom: 'MÉMOIRE' }, 0)}</div>`)
    levier(h, 'REPRENDRE LA DESCENTE ▸')
  }

  // ---- LE CHOIX APRÈS UN LANCER DE PALET (main.ts mbMontreChoixPalet) ----
  function palet() {
    const host = halteBase('LE PALET', 'LANCER 1 / 3 — 42 u DU CENTRE · ÉCORNÉ')
    const r = rangee(halte(host, 'palet'))
    const offre = (i, icone, nom, detail) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mb-cartouche mb-offre'
      b.style.setProperty('--i', String(i))
      b.innerHTML = F.offreHTML({ icone, nom, detail })
      r.appendChild(b)
    }
    offre(0, 'palet', 'LANCER 2 / 3', 'remise en place au départ, même volume de base')
    offre(1, 'note', 'VALIDER', 'garder le meilleur : 42 u · ÉCORNÉ')
  }

  // ---- LA FIN ORDINAIRE (main.ts mbMontreFin, mbJauges) ----
  function fin() {
    bandeau()
    $('mb-titre').textContent = 'SALLE FRANCHIE'
    $('mb-choix-titre').textContent = 'PAROI DU SAS OUVERTE'
    const etal = $('mb-etal'); etal.hidden = false; etal.classList.remove('coule'); etal.classList.add('mb-mince')
    $('mb-etal-tampon').hidden = true; $('mb-etal-gain').hidden = true
    peintEtal(RUN.xp + RUN.surplus)
    const host = cartes()
    const j = document.createElement('div'); j.className = 'mb-jauges'
    j.innerHTML = [
      F.plaqueHTML({ cle: 'reserve', icone: 'reserve', valeur: `${virgule(RUN.bonbonne)} / ${RUN.cap} L`, nom: 'RÉSERVE' }, 0),
      F.plaqueHTML({ cle: 'condensat', icone: 'condensat', valeur: `${RUN.condensat} cL`, nom: 'BOURSE' }, 1),
      F.plaqueHTML({ cle: 'secours', icone: 'secours', valeur: '×2', nom: 'ÉCHANTILLONS' }, 2),
      F.plaqueHTML({ cle: 'profondeur', icone: 'profondeur', valeur: `${RUN.rang} / ${RUN.longueur}`, nom: 'PROFONDEUR' }, 3),
    ].join('')
    host.appendChild(j)
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'mb-levier mb-halte-levier'; btn.textContent = 'SALLE SUIVANTE ▸'
    host.appendChild(btn)
  }

  // ---- HORS CÉRÉMONIE : #overlay (main.ts:18911 showOverlay ; 20404 fin de run, 17873 défaite) ----
  function overlay(quoi) {
    veil.hidden = true
    const o = $('overlay')
    o.style.zIndex = '2147483647'
    o.classList.remove('success', 'danger', 'end')
    if (quoi === 'bouclee') {
      $('overlay-title').textContent = 'LA DESCENTE EST BOUCLÉE'
      $('overlay-sub').innerHTML = `<span class="bilan"><span class="bilan-l">18/18 salles · 💧 61,40 L · ⏱ 24:12 — <em class="bilan-neuf">MEILLEURE DESCENTE ✦</em></span></span>` +
        `Descente de 18 salles, du premier sas au dernier.<br>Butin de la descente : ${['aimant-rosee', 'croc-du-sas', 'ration-de-survie'].map((id) => F.INSTRUMENTS.find((d) => d.id === id)?.icone ?? '').join(' ')} 3 instrument(s) · palier de maîtrise 4 · +86 MÉMOIRE gravée — la purge confisque le condensat restant (1890 cL).<br>` +
        `Palmarès du poste : 2 bouclée(s) · profondeur record 18 · meilleur livré 61,40 L.`
      o.classList.add('visible', 'success', 'end')
      $('overlay-btn').textContent = 'RETOUR AU LABO'
    } else {
      $('overlay-title').textContent = 'ÉCHANTILLON PERDU — FIN DE LA RUN'
      $('overlay-sub').textContent = 'La dispersion a eu raison du dernier échantillon. Le laboratoire vous rappelle.'
      o.classList.add('visible', 'danger', 'end')
      $('overlay-btn').textContent = 'RETOUR AU LABO'
    }
  }

  window.POSE = { vocabulaire, bilan, versement, etalonnage, draft, salles, module, carte, repos, don, cache, evenement, minijeu, palet, fin, overlay, feu, fige, MB_OR, MB_MENTHE, MB_EAU, RUN }
})()
