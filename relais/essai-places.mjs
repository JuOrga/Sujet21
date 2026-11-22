// L'ESSAI DES PROTECTIONS DU RELAIS, sur le serveur entier (relais/places.js
// dit pourquoi elles existent). À lancer contre un relais LOCAL :
//
//   PORT=9100 node index.js &
//   node essai-places.mjs ws://127.0.0.1:9100/ws
//
// Il joue cinq scènes et dit, pour chacune, ce que le relais a fait.

import { WebSocket } from 'ws'

const adresse = process.argv[2] ?? 'ws://127.0.0.1:9100/ws'
const ORIGINE = 'http://localhost'
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
const jeton = () => Array.from({ length: 32 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

/** Une connexion : elle note si elle a été fermée, et par quel code. */
function connexion(c, role, j) {
  const ws = new WebSocket(`${adresse}?code=${c}&role=${role}${j === undefined ? '' : '&jeton=' + j}`, { origin: ORIGINE })
  const etat = { ws, ferme: null, ouverte: false }
  ws.on('open', () => (etat.ouverte = true))
  ws.on('close', (codeFermeture) => (etat.ferme = codeFermeture))
  ws.on('error', () => {})
  return etat
}

let echecs = 0
const verifie = (nom, ok, detail) => {
  console.log(`${ok ? 'OK   ' : 'ÉCHEC'} ${nom}${detail ? ' — ' + detail : ''}`)
  if (!ok) echecs++
}

// 1. un intrus avec le bon code ne prend la place de personne
{
  const c = code()
  const hote = connexion(c, 'hote', jeton())
  const invite = connexion(c, 'invite', jeton())
  await pause(400)
  const intrusInvite = connexion(c, 'invite', jeton())
  const intrusHote = connexion(c, 'hote', jeton())
  const ancien = connexion(c, 'invite') // un client d'avant les jetons
  await pause(400)
  verifie('un intrus sur la place de l’invité est refusé', intrusInvite.ferme === 4423, `fermé ${intrusInvite.ferme}`)
  verifie('un intrus sur la place de l’hôte est refusé', intrusHote.ferme === 4423, `fermé ${intrusHote.ferme}`)
  verifie('un client sans jeton est refusé sur une place tenue', ancien.ferme === 4423, `fermé ${ancien.ferme}`)
  verifie('les deux joueurs sont toujours là', hote.ferme === null && invite.ferme === null)
  hote.ws.close()
  invite.ws.close()
}

// 2. celui qui revient avec SON jeton reprend sa place
{
  const c = code()
  const jInvite = jeton()
  const hote = connexion(c, 'hote', jeton())
  const invite = connexion(c, 'invite', jInvite)
  await pause(400)
  const retour = connexion(c, 'invite', jInvite)
  await pause(400)
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
  const c = code()
  const hote = connexion(c, 'hote', jeton())
  const invite = connexion(c, 'invite', jeton())
  await pause(400)
  let octets = 0
  invite.ws.on('message', (d, binaire) => binaire && (octets += d.length))
  const image = Buffer.alloc(Math.round((212 * 1024) / 20))
  for (let k = 0; k < 60; k++) {
    hote.ws.send(image, { binary: true })
    await pause(50)
  }
  await pause(300)
  verifie('une partie réelle passe entière', octets === image.length * 60 && hote.ferme === null, `${octets} octets reçus sur ${image.length * 60}`)
  hote.ws.close()
  invite.ws.close()
}

// 4. un flot de 2 Mo/s est jeté, puis coupé
{
  const c = code()
  const hote = connexion(c, 'hote', jeton())
  const invite = connexion(c, 'invite', jeton())
  await pause(400)
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

// 5. une même adresse ne tient pas plus de huit connexions
{
  const tenues = []
  for (let k = 0; k < 9; k++) tenues.push(connexion(code(), 'hote', jeton()))
  await pause(600)
  const refusees = tenues.filter((t) => t.ferme === 4429).length
  verifie('la neuvième connexion d’une même adresse est refusée', refusees === 1, `${refusees} refusée(s)`)
  for (const t of tenues) t.ws.close()
}

console.log(echecs === 0 ? 'PROTECTIONS BONNES.' : `${echecs} ÉCHEC(S).`)
process.exit(echecs === 0 ? 0 : 1)
