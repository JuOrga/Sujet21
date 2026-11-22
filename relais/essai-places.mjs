// L'ESSAI DES PROTECTIONS DU RELAIS, sur le serveur entier (relais/places.js
// dit pourquoi elles existent). En local :
//
//   PORT=9100 node index.js &
//   node essai-places.mjs ws://127.0.0.1:9100/ws
//
// et en ligne, par le workflow relais, contre l'alias. Il joue cinq scènes et
// dit, pour chacune, ce que le relais a fait.
//
// EN LIGNE, LES CONNEXIONS SE RÉPARTISSENT ENTRE PLUSIEURS INSTANCES, chacune
// avec ses salons et ses comptes. Le premier passage en ligne (22/11) a donc
// donné trois faux échecs : la reconnexion, la partie réelle et la neuvième
// connexion tombaient sur une autre instance que la partie. Les scènes
// attendent maintenant d'être sur la même instance — comme le jeu, qui ne
// démarre qu'une fois apparié — et la dernière dit combien d'instances elle a
// touchées : la limite par adresse vaut PAR INSTANCE.

import { WebSocket } from 'ws'

const adresse = process.argv[2] ?? 'ws://127.0.0.1:9100/ws'
const ORIGINE = 'http://localhost'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
const jeton = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/** Une connexion : elle note si elle a été fermée (et par quel code), sur
 *  quelle instance du relais elle est tombée, et si elle a un partenaire.
 *  (EN LIGNE, Vercel répartit les connexions entre plusieurs instances, et
 *  chacune a ses salons : deux joueurs ne se trouvent que sur la même. Les
 *  scènes à deux attendent donc d'être appariées, comme le jeu.) */
function connexion(c, role, j) {
  const ws = new WebSocket(`${adresse}?code=${c}&role=${role}${j === undefined ? '' : '&jeton=' + j}`, { origin: ORIGINE })
  const etat = { ws, ferme: null, ouverte: false, instance: '', pair: false }
  ws.on('open', () => (etat.ouverte = true))
  ws.on('message', (d, binaire) => {
    if (binaire) return
    const m = JSON.parse(d.toString())
    if (m.r === 'salut') {
      etat.instance = m.instance
      if (!m.seul) etat.pair = true
    }
    if (m.r === 'pair') etat.pair = true
  })
  ws.on('close', (codeFermeture) => (etat.ferme = codeFermeture))
  ws.on('error', () => {})
  return etat
}

/** Attend que `condition` soit vraie, `ms` au plus. */
async function attend(condition, ms = 5000) {
  const fin = Date.now() + ms
  while (!condition() && Date.now() < fin) await pause(50)
  return condition()
}

/** Une paire appariée sous un code neuf, ou null si elle ne s'est pas faite
 *  (les deux sur deux instances différentes). */
async function paire() {
  const c = code()
  const hote = connexion(c, 'hote', jeton())
  await attend(() => hote.instance !== '')
  const invite = connexion(c, 'invite', jeton())
  const faite = await attend(() => hote.pair && invite.pair)
  if (!faite) {
    console.log(`(paire non faite : hôte sur ${hote.instance}, invité sur ${invite.instance} — on recommence)`)
    hote.ws.close()
    invite.ws.close()
    return null
  }
  return { c, hote, invite }
}
async function paireSure() {
  for (let essai = 0; essai < 5; essai++) {
    const p = await paire()
    if (p) return p
  }
  throw new Error('aucune paire en cinq essais')
}

let echecs = 0
const verifie = (nom, ok, detail) => {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!ok) echecs++
}

// 1. un intrus avec le bon code ne prend la place de personne (s'il tombe
//    sur l'instance de la partie : sinon il ne la trouve même pas)
{
  const { c, hote, invite } = await paireSure()
  const intrusInvite = connexion(c, 'invite', jeton())
  const intrusHote = connexion(c, 'hote', jeton())
  const ancien = connexion(c, 'invite') // un client d'avant les jetons
  await attend(() => [intrusInvite, intrusHote, ancien].every((x) => x.ferme !== null || x.instance !== ''), 3000)
  await pause(500)
  for (const [nom, x] of [['invité', intrusInvite], ['hôte', intrusHote], ['sans jeton', ancien]]) {
    if (x.ferme === null && x.instance !== hote.instance) console.log(`(l'intrus ${nom} est tombé sur une autre instance, ${x.instance} : il n'a pas vu la partie)`)
  }
  // refusé — ou ailleurs, sur une autre instance, sans avoir touché la partie
  const ecarte = (x) => x.ferme === 4423 || (x.ferme === null && x.instance !== hote.instance)
  verifie('un intrus sur la place de l’invité est écarté', ecarte(intrusInvite), `fermé ${intrusInvite.ferme}`)
  verifie('un intrus sur la place de l’hôte est écarté', ecarte(intrusHote), `fermé ${intrusHote.ferme}`)
  verifie('un client sans jeton est écarté d’une place tenue', ecarte(ancien), `fermé ${ancien.ferme}`)
  for (const x of [intrusInvite, intrusHote, ancien]) x.ws.close()
  verifie('les deux joueurs sont toujours là', hote.ferme === null && invite.ferme === null)
  hote.ws.close()
  invite.ws.close()
}

// 2. celui qui revient avec SON jeton reprend sa place (sur l'instance de la
//    partie ; ailleurs, il ne la trouverait pas — c'est le cas du jeu aussi,
//    qui réessaie)
{
  let scene = null
  for (let essai = 0; essai < 5 && !scene; essai++) {
    const c = code()
    const jInvite = jeton()
    const hote = connexion(c, 'hote', jeton())
    await attend(() => hote.instance !== '')
    const invite = connexion(c, 'invite', jInvite)
    if (!(await attend(() => hote.pair && invite.pair))) {
      hote.ws.close()
      invite.ws.close()
      continue
    }
    const retour = connexion(c, 'invite', jInvite)
    await attend(() => retour.instance !== '' || retour.ferme !== null, 3000)
    if (retour.instance !== hote.instance) {
      console.log(`(le revenant est tombé sur une autre instance, ${retour.instance} — on recommence)`)
      for (const x of [hote, invite, retour]) x.ws.close()
      continue
    }
    scene = { hote, invite, retour }
  }
  const { hote, invite, retour } = scene
  await attend(() => invite.ferme !== null, 3000)
  verifie('le même jeton reprend la place (reconnexion)', retour.ferme === null && invite.ferme === 4409, `ancienne fermée ${invite.ferme}, nouvelle ${retour.ferme}`)
  // et la partie passe toujours : un message de l'hôte arrive au revenant
  let recu = false
  retour.ws.on('message', (d, binaire) => (recu ||= binaire))
  hote.ws.send(Buffer.alloc(100), { binary: true })
  await pause(300)
  verifie('la partie passe toujours après la reconnexion', recu)
  hote.ws.close()
  retour.ws.close()
}

// 3. une partie réelle passe : 212 Ko/s pendant trois secondes
{
  const { hote, invite } = await paireSure()
  let octets = 0
  invite.ws.on('message', (d, binaire) => binaire && (octets += d.length))
  const image = Buffer.alloc(Math.round((212 * 1024) / 20))
  for (let k = 0; k < 60; k++) {
    hote.ws.send(image, { binary: true })
    await pause(50)
  }
  await pause(600)
  verifie('une partie réelle passe entière', octets === image.length * 60 && hote.ferme === null, `${octets} octets reçus sur ${image.length * 60}`)
  hote.ws.close()
  invite.ws.close()
}

// 4. un flot de 2 Mo/s est jeté, puis coupé
{
  const { hote, invite } = await paireSure()
  let octets = 0
  invite.ws.on('message', (d, binaire) => binaire && (octets += d.length))
  const gros = Buffer.alloc(60 * 1024)
  const debut = Date.now()
  while (hote.ferme === null && Date.now() - debut < 9000) {
    if (hote.ws.readyState === hote.ws.OPEN) hote.ws.send(gros, { binary: true })
    await pause(30)
  }
  await pause(300)
  const duree = (Date.now() - debut) / 1000
  verifie('un flot excessif est coupé', hote.ferme === 4429, `fermé ${hote.ferme} au bout de ${duree.toFixed(1)} s`)
  verifie('et ce qui en passe reste sous le plafond', octets / duree <= 800 * 1024, `${Math.round(octets / duree / 1024)} Ko/s passés`)
  invite.ws.close()
}

// 5. une même adresse ne tient pas plus de huit connexions PAR INSTANCE :
//    chaque instance compte pour elle seule (en ligne, les connexions se
//    répartissent — la limite est alors plus large, on le dit)
{
  const tenues = []
  for (let k = 0; k < 9; k++) tenues.push(connexion(code(), 'hote', jeton()))
  await attend(() => tenues.every((t) => t.instance !== '' || t.ferme !== null), 5000)
  const refusees = tenues.filter((t) => t.ferme === 4429).length
  const parInstance = new Map()
  for (const t of tenues) if (t.instance) parInstance.set(t.instance, (parInstance.get(t.instance) ?? 0) + 1)
  const pleine = [...parInstance.values()].some((n) => n > 8)
  const detail = `${refusees} refusée(s) ; ${parInstance.size} instance(s) touchée(s) : ${[...parInstance.entries()].map(([i, n]) => i + '×' + n).join(', ')}`
  verifie('une instance ne tient pas plus de huit connexions d’une même adresse', !pleine && (parInstance.size > 1 || refusees === 1), detail)
  for (const t of tenues) t.ws.close()
}

console.log(echecs === 0 ? 'PROTECTIONS BONNES.' : `${echecs} ÉCHEC(S).`)
process.exit(echecs === 0 ? 0 : 1)
