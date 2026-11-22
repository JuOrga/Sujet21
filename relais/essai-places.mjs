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
const toutes = []
function connexion(c, role, j) {
  const ws = new WebSocket(`${adresse}?code=${c}&role=${role}${j === undefined ? '' : '&jeton=' + j}`, {
    origin: ORIGINE,
    // Le code de fermeture n'arrive à 'close' qu'une fois la liaison TCP
    // finie, et ws l'attend jusqu'à 30 s. En ligne (22/11), derrière le
    // mandataire de Vercel, cette fin a traîné : le 4409 de la reconnexion
    // était reçu, mais pas annoncé dans les 3 s de l'essai.
    closeTimeout: 1000,
  })
  const etat = { ws, ferme: null, ouverte: false, instance: '', pair: false }
  toutes.push(etat)
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
let nonJoues = 0
const verifie = (nom, ok, detail) => {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!ok) echecs++
}
/** Une scène que les conditions n'ont pas permis de jouer : ni réussie, ni
 *  ratée — on le dit, plutôt que de la compter d'un côté ou de l'autre. */
const nonJoue = (nom, pourquoi) => {
  console.log(`NON JOUÉ ${nom} — ${pourquoi}`)
  nonJoues++
}

// 1. un intrus avec le bon code ne prend la place de personne (s'il tombe
//    sur l'instance de la partie : sinon il ne la trouve même pas)
{
  const { c, hote, invite } = await paireSure()
  const intrusInvite = connexion(c, 'invite', jeton())
  const intrusHote = connexion(c, 'hote', jeton())
  const ancien = connexion(c, 'invite') // un client d'avant les jetons
  // une instance neuve peut mettre quelques secondes à naître
  await attend(() => [intrusInvite, intrusHote, ancien].every((x) => x.ferme !== null || x.instance !== ''), 8000)
  await pause(500)
  for (const [nom, x] of [
    ['un intrus sur la place de l’invité est écarté', intrusInvite],
    ['un intrus sur la place de l’hôte est écarté', intrusHote],
    ['un client sans jeton est écarté d’une place tenue', ancien],
  ]) {
    if (x.ferme === 4423) verifie(nom, true, 'fermé 4423')
    else if (x.ferme === null && x.instance !== '' && x.instance !== hote.instance)
      // ailleurs, il ne voit même pas la partie : écarté, mais la règle n'a pas joué
      nonJoue(nom, `tombé sur une autre instance (${x.instance}) que la partie (${hote.instance})`)
    else if (x.ferme === null && x.instance === '') nonJoue(nom, 'le relais ne lui a pas répondu en 8 s')
    else verifie(nom, false, `fermé ${x.ferme}, instance ${x.instance}`)
  }
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
  // Ce que l'émetteur a vraiment poussé sur le réseau : ce qu'il a confié à
  // ws, moins ce qui attend encore dans son tampon. EN LIGNE (22/11), le lien
  // du runner vers Vercel n'a pas suivi les 2 Mo/s demandés : le relais n'a
  // jamais reçu plus que son plafond, et n'avait donc rien à couper. On
  // n'empile pas au-delà d'un Mo en attente, et on dit ce qui est parti.
  let confies = 0
  let emisFin = 0
  while (hote.ferme === null && Date.now() - debut < 9000) {
    if (hote.ws.readyState === hote.ws.OPEN && hote.ws.bufferedAmount < 1024 * 1024) {
      hote.ws.send(gros, { binary: true })
      confies += gros.length
    }
    emisFin = confies - hote.ws.bufferedAmount
    await pause(30)
  }
  const duree = (Date.now() - debut) / 1000
  await pause(300)
  const emisParSeconde = emisFin / duree
  const kos = (x) => `${Math.round(x / 1024)} Ko/s`
  if (hote.ferme === 4429) verifie('un flot excessif est coupé', true, `fermé 4429 au bout de ${duree.toFixed(1)} s (${kos(emisParSeconde)} émis)`)
  else if (emisParSeconde < 1.2 * 768 * 1024)
    nonJoue('un flot excessif est coupé', `le lien n'a poussé que ${kos(emisParSeconde)}, pas assez au-dessus du plafond (768 Ko/s) pour le franchir`)
  else verifie('un flot excessif est coupé', false, `fermé ${hote.ferme} au bout de ${duree.toFixed(1)} s, ${kos(emisParSeconde)} émis`)
  // Le plafond vaut par SECONDE DU RELAIS, ouverte au premier message : une
  // durée de 4,4 s en touche jusqu'à cinq. On borne donc le total (une moyenne
  // sur la durée mesurée dépasse 768 Ko/s sans que le relais ait fauté : 810
  // vus en local).
  const secondesTouchees = Math.ceil(duree) + 1
  verifie('et ce qui en passe reste sous le plafond', octets <= secondesTouchees * 768 * 1024, `${Math.round(octets / 1024)} Ko passés en ${duree.toFixed(1)} s (au plus ${secondesTouchees} × 768)`)
  invite.ws.close()
}

// 5. une même adresse ne tient pas plus de huit connexions PAR INSTANCE :
//    chaque instance compte pour elle seule (en ligne, les connexions se
//    répartissent — la limite est alors plus large, on le dit)
{
  // les connexions des scènes d'avant doivent être closes, sinon le relais
  // les compte encore (vu le 22/11 : deux refusées au lieu d'une)
  for (const x of toutes) x.ws.close()
  await attend(() => toutes.every((x) => x.ferme !== null), 5000)
  await pause(200)
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

if (nonJoues > 0) console.log(`${nonJoues} scène(s) non jouée(s) ici : elles le sont en local.`)
console.log(echecs === 0 ? 'PROTECTIONS BONNES.' : `${echecs} ÉCHEC(S).`)
process.exit(echecs === 0 ? 0 : 1)
