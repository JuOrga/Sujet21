// LE RELAIS DU MULTI — un salon par code, deux joueurs, et rien d'autre.
//
// POURQUOI UN SERVEUR (le concepteur et son ami, 19/11). Le multi a d'abord
// relié les deux navigateurs EN DIRECT, sans serveur, pour rester gratuit.
// Trois essais entre deux maisons, trois échecs : deux codes à relayer à la
// main (un délai que personne ne tenait), un annuaire public qui raccroche,
// et pour finir deux réseaux qui se refusent — « mise en relation faite,
// liaison refusée », le relais public muet des deux côtés. Entre certains
// réseaux, deux navigateurs ne se joignent JAMAIS en direct ; il faut un
// tiers par qui tout passe. Le concepteur : « est-ce qu'on peut passer par
// un serveur sur Vercel ? » — oui : ses fonctions tiennent désormais des
// connexions ouvertes (WebSocket).
//
// CE QU'IL FAIT. Chaque joueur ouvre une connexion vers /ws avec le code de
// la partie et son rôle (hôte ou invité). Tout ce que l'un envoie est remis
// à l'autre, tel quel : le relais ne lit pas la partie, il ne simule rien,
// il ne garde rien. Un réseau qui affiche une page web laisse passer cette
// connexion — c'est tout l'intérêt.
//
// CE QU'IL NE GARANTIT PAS, et que le client sait :
//  - une fonction Vercel a une durée maximale : la connexion est coupée de
//    temps en temps, le client la rouvre aussitôt et reprend sa place ;
//  - les salons vivent dans la MÉMOIRE de l'instance. Si les deux joueurs
//    tombaient sur deux instances différentes ils ne se verraient pas : le
//    relais dit à chacun le nom de son instance, et l'invité qui ne trouve
//    personne se reconnecte avant de conclure que le code est faux.
//
// OÙ IL VIT : dans le projet Vercel du jeu, mais comme un déploiement À
// PART qui ne contient que ce dossier (.github/workflows/relais.yml dit
// pourquoi pas un projet à lui). Rien ici n'est importé par le jeu, et le
// jeu n'a pas à dépendre de ce prototype.

import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import express from 'express'
import { WebSocketServer } from 'ws'

/** Le nom de cette instance : deux joueurs qui ne lisent pas le même nom ne
 *  sont pas sur la même machine, et ne peuvent pas se voir. */
const INSTANCE = randomBytes(3).toString('hex')
const NEE = Date.now()

/** Un code de partie : cinq caractères, sans I, O, 0 ni 1 (le même alphabet
 *  que src/multi/code.ts). */
const CODE = /^[A-HJ-NP-Z2-9]{5}$/
/** Une trame d'état pèse ~6 Ko ; rien de légitime n'approche cette limite. */
const TRAME_MAX = 64 * 1024
/** Au-delà, celui qui reçoit ne suit pas : on jette les images plutôt que de
 *  les empiler (elles seraient vieilles en arrivant). Les messages en texte,
 *  eux, ne se perdent pas. */
const FILE_MAX = 512 * 1024
/** Assez pour un prototype ; au-delà c'est un abus, pas un succès. */
const SALONS_MAX = 200

/** D'où l'on a le droit d'ouvrir une connexion : le jeu (en ligne, en
 *  aperçu) et un poste de développement. Un navigateur envoie toujours
 *  l'origine de la page ; ce contrôle écarte les autres sites, pas un
 *  programme qui mentirait — le relais ne protège aucun secret. */
function origineAdmise(origine) {
  if (!origine) return false
  try {
    const u = new URL(origine)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return u.protocol === 'https:' && /^sujet21(-[a-z0-9-]+)?\.vercel\.app$/.test(u.hostname)
  } catch {
    return false
  }
}

/** code → { hote, invite } : les deux connexions d'un salon (ou null). */
const salons = new Map()

const dit = (ws, message) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(message))
}

function installe(ws, code, role) {
  let salon = salons.get(code)
  if (!salon) {
    if (salons.size >= SALONS_MAX) {
      ws.close(4503, 'relais plein')
      return
    }
    salon = { hote: null, invite: null }
    salons.set(code, salon)
  }
  // Une place déjà tenue : c'est le même joueur qui revient (sa connexion
  // vient d'être coupée par la durée maximale) — le nouveau prend la place,
  // l'ancien est congédié. Un inconnu qui taperait le code d'une partie en
  // cours prendrait la place de l'invité : pour un prototype entre amis,
  // c'est admis ; un vrai mode demandera un jeton par joueur.
  const ancien = salon[role]
  salon[role] = ws
  if (ancien && ancien !== ws) ancien.close(4409, 'remplacé')
  const autre = () => (role === 'hote' ? salon.invite : salon.hote)

  dit(ws, { r: 'salut', instance: INSTANCE, seul: !autre() })
  if (autre()) {
    dit(ws, { r: 'pair' })
    dit(autre(), { r: 'pair' })
  }

  ws.on('message', (donnee, binaire) => {
    const vers = autre()
    if (!vers || vers.readyState !== vers.OPEN) return
    if (binaire && vers.bufferedAmount > FILE_MAX) return
    vers.send(donnee, { binary: binaire })
  })
  ws.on('close', () => {
    if (salon[role] !== ws) return // remplacé : la place est déjà reprise
    salon[role] = null
    dit(autre(), { r: 'seul' })
    if (!salon.hote && !salon.invite) salons.delete(code)
  })
  ws.on('error', () => ws.close())
}

const app = express()
// le pouls du relais, pour qui veut savoir s'il vit (et sur quelle instance)
app.get('/', (_req, res) => {
  res.json({ relais: 'sujet21', instance: INSTANCE, salons: salons.size, depuis: Math.round((Date.now() - NEE) / 1000) })
})

const server = createServer(app)
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: TRAME_MAX,
  verifyClient: ({ origin }) => origineAdmise(origin),
})
wss.on('connection', (ws, req) => {
  const q = new URL(req.url ?? '/', 'http://relais').searchParams
  const code = (q.get('code') ?? '').toUpperCase()
  const role = q.get('role')
  if (!CODE.test(code) || (role !== 'hote' && role !== 'invite')) {
    ws.close(4400, 'code ou rôle invalide')
    return
  }
  installe(ws, code, role)
})

// en local : `PORT=9100 node index.js` écoute ; sur Vercel, c'est la
// plateforme qui prend le serveur exporté
if (process.env.PORT && !process.env.VERCEL) {
  server.listen(Number(process.env.PORT), '127.0.0.1', () => console.log(`relais local prêt sur 127.0.0.1:${process.env.PORT} (instance ${INSTANCE})`))
}

export default server
