// L'ESSAI DU RELAIS EN LIGNE — deux connexions, comme deux joueurs.
//
// L'environnement d'analyse ne joint pas le relais déployé ; le serveur de
// GitHub, si (c'est toute la raison des branches gâchettes, ops/LISEZ-MOI.md).
// Ce script s'y lance après le déploiement : un hôte et un invité prennent
// place sous un code tiré au sort, l'hôte envoie des images de la taille des
// vraies pendant quelques secondes, et l'on compte ce qui arrive, en combien
// de temps, et si les deux sont bien sur la MÊME instance — la seule chose
// qu'aucun essai local ne peut dire.
//
//   node essai.mjs wss://<domaine>/ws [secondes]

import { WebSocket } from 'ws'

const adresse = process.argv[2]
const duree = Number(process.argv[3] ?? 6)
if (!adresse) {
  console.error('usage : node essai.mjs wss://<domaine>/ws [secondes]')
  process.exit(2)
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
const ORIGINE = 'https://sujet21.vercel.app'
const IMAGE = 5452 // un morceau d'image : 1 800 particules en deux morceaux de ~5,4 Ko
const CADENCE = 20

function joueur(role) {
  const ws = new WebSocket(`${adresse}?code=${code}&role=${role}`, { origin: ORIGINE })
  const j = { ws, role, instance: '', pair: false, recus: 0, octets: 0, latences: [], ferme: null }
  ws.on('message', (donnee, binaire) => {
    if (binaire) {
      j.recus++
      j.octets += donnee.length
      // les huit premiers octets portent l'heure d'envoi
      j.latences.push(Date.now() - Number(donnee.readBigUInt64LE(0)))
      return
    }
    const m = JSON.parse(donnee.toString())
    if (m.r === 'salut') j.instance = m.instance
    if (m.r === 'pair') j.pair = true
  })
  ws.on('close', (c, r) => (j.ferme = `code ${c} ${r}`))
  ws.on('error', (e) => (j.ferme = 'erreur : ' + e.message))
  return j
}

const attend = (ms) => new Promise((r) => setTimeout(r, ms))
async function jusqua(test, ms) {
  const t0 = Date.now()
  while (!test() && Date.now() - t0 < ms) await attend(50)
  return test()
}

const hote = joueur('hote')
if (!(await jusqua(() => hote.instance !== '' || hote.ferme, 15000)) || hote.ferme) {
  console.log(`ÉCHEC : l'hôte n'a pas été installé (${hote.ferme ?? 'relais muet'})`)
  process.exit(1)
}
console.log(`hôte installé, code ${code}, instance ${hote.instance}`)
await attend(1500)
const invite = joueur('invite')
if (!(await jusqua(() => (hote.pair && invite.pair) || invite.ferme, 15000)) || invite.ferme) {
  console.log(`ÉCHEC : pas de paire — invité sur l'instance « ${invite.instance} », hôte sur « ${hote.instance} » (${invite.ferme ?? 'jamais appariés'})`)
  console.log(invite.instance && invite.instance !== hote.instance ? '→ DEUX INSTANCES : les salons en mémoire ne suffisent pas.' : '')
  process.exit(1)
}
console.log(`paire faite : invité sur l'instance ${invite.instance} — ${invite.instance === hote.instance ? 'la même' : 'UNE AUTRE'}`)

let envoyes = 0
const t0 = Date.now()
const horloge = setInterval(() => {
  // deux morceaux par image, comme le jeu
  for (let k = 0; k < 2; k++) {
    const trame = Buffer.alloc(IMAGE)
    trame.writeBigUInt64LE(BigInt(Date.now()), 0)
    hote.ws.send(trame)
    envoyes++
  }
}, 1000 / CADENCE)
await attend(duree * 1000)
clearInterval(horloge)
await attend(1500)

const l = invite.latences.slice().sort((a, b) => a - b)
const q = (p) => (l.length ? l[Math.min(l.length - 1, Math.floor(l.length * p))] : -1)
const secondes = (Date.now() - t0 - 1500) / 1000
console.log(`envoyés ${envoyes} morceaux en ${secondes.toFixed(1)} s, reçus ${invite.recus} (${Math.round(invite.octets / 1024 / secondes)} Ko/s)`)
console.log(`trajet hôte → relais → invité : médiane ${q(0.5)} ms, 95e centile ${q(0.95)} ms, pire ${l[l.length - 1] ?? -1} ms`)
hote.ws.close()
invite.ws.close()
const ok = invite.recus === envoyes
console.log(ok ? 'RELAIS BON : tout ce qui est parti est arrivé.' : `RELAIS DOUTEUX : ${envoyes - invite.recus} morceaux manquent.`)
process.exit(ok ? 0 : 1)
