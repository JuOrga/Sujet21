// L'ÉCRAN MULTI — créer une partie, la rejoindre, y jouer à deux.
//
// Un prototype, derrière le mode concepteur (le concepteur, 19/11 : « un
// nouvel écran, Multi, que pour les concepteurs pour l'instant »). Il est
// chargé à la demande (main.ts, import()) : un joueur qui n'ouvre jamais le
// mode concepteur ne télécharge rien de ce dossier.
//
// L'écran se suffit : il fabrique son gabarit et sa feuille de style ici,
// au lieu d'ajouter trois cents lignes à index.html pour un essai qui peut
// ne pas survivre. S'il devient un vrai mode, il rejoindra la page.
//
// QUI FAIT QUOI :
//  - l'HÔTE (celui qui crée) fait tourner la simulation et envoie l'état ;
//  - l'INVITÉ (celui qui rejoint) envoie sa commande et affiche ;
//  - SEUL : les deux corps sur une machine, pour essayer sans personne.

import { cadreSalle, cadreVoulu, ecranVersMonde, mondeVersEcran, presenceTrait, suitCadre, traitDeVisee, type Cadre } from './cadrage'
import { ALPHABET_CODE, litCodePartie, LONGUEUR_CODE } from './code'
import { CADENCE_ETAT, CAPACITE, Hote, Miroir, SALLE } from './partie'
import {
  BUTS_POUR_GAGNER,
  CERCLE_DECALAGE,
  CERCLE_ECART,
  DEMI_FOND,
  DEMI_OUVERTURE,
  EPAISSEUR_CAGE,
  LIGNE_BUT,
  POTEAUX,
  PROFONDEUR_CAGE,
  RAYON_CERCLE,
  RAYON_COINS,
  RAYON_PALET,
  RAYON_POTEAU,
} from './hockey'
import { Robot } from './robot'
import { ARENE, MANCHES_POUR_GAGNER } from './sumo'
import { commandeManette, defileCaractere, ligneLocale, ligneManettes, litManette, litMenu, manettesDuLocal, nouvelEtatManette, nouvelEtatMenu, voisinMenu, type PadLu, type PadVu } from './manetteMulti'
import { adresseRelais, creePartie, liaisonPossible, rejointPartie, type EtatLiaison, type Liaison, type Ordre } from './relais'
import { NOMS_COULEURS, PALETTE, PSEUDO_MAX, chargeProfil, couleursDeLaPartie, gardeProfil, litProfil, nettoiePseudo, type Profil } from './profil'
import { DUREE_ECLAT, ECLATS_MAX, RenduMulti, coeursDe, couleurCss, type Eclat, type SceneHockey } from './renduMulti'
import { SonsMulti, chiffreDecompte, entend, type Instantane } from './sonsMulti'
import {
  MODE_HOCKEY,
  MODE_LIBRE,
  MODE_SUMO,
  PHASE_BUT,
  PHASE_DECOMPTE,
  PHASE_FINI,
  PHASE_JEU,
  VERSION_TRAME,
  decodeCommande,
  encodeCommande,
  type Bornes,
  type Commande,
  type CorpsTrame,
  type JeuTrame,
  type Particules,
} from './trame'

/** hote, invite : à deux par le réseau · robot : contre l'ordinateur · local :
 *  à deux sur cet écran · seul : l'outil d'essai, on pilote un corps à la fois. */
type Role = 'hote' | 'invite' | 'seul' | 'robot' | 'local'
type Page = 'salon' | 'creation' | 'jonction' | 'jeu'

export interface EcranMulti {
  /** Ouvre l'écran. Avec un code (celui d'un lien d'invitation), il va
   *  droit rejoindre cette partie. */
  ouvre(code?: string): void
  ferme(): void
  ouvert(): boolean
}

const STYLE = `
#multi { position: fixed; inset: 0; z-index: 200; background: var(--void, #030710); color: var(--ink, #d9ecf7);
  font-family: var(--font-mono, monospace); font-size: calc(14px * var(--ui, 1)); display: flex; }
#multi[hidden], #multi [hidden] { display: none !important; }
#multi button { font: inherit; color: inherit; background: rgba(150, 200, 235, 0.07); border: 1px solid var(--line-strong, rgba(150,200,235,.38));
  padding: 0.7em 1.2em; cursor: pointer; letter-spacing: 0.08em; }
#multi button:hover:not(:disabled), #multi button:focus-visible { background: rgba(150, 200, 235, 0.18); outline: none; border-color: var(--glow, #a7ddf5); }
#multi button:disabled { opacity: 0.4; cursor: default; }
#multi button.mu-fort { background: rgba(99, 183, 230, 0.2); border-color: var(--specimen, #63b7e6); }
#multi button.mu-discret { border-color: var(--line, rgba(150,200,235,.16)); color: var(--dim, #7f9cb0); }
.mu-salon { margin: auto; width: min(680px, calc(100% - 36px)); display: flex; flex-direction: column; gap: 1.1em; padding: 24px 0; max-height: 100%; overflow-y: auto; }
.mu-titre { font-family: var(--font-display, sans-serif); font-size: calc(22px * var(--ui, 1)); letter-spacing: 0.2em; margin: 0; }
.mu-etape { border: 1px solid var(--line, rgba(150,200,235,.16)); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.mu-etape h3 { margin: 0; font-size: 1em; font-weight: 400; letter-spacing: 0.1em; color: var(--glow, #a7ddf5); }
.mu-etape p { margin: 0; color: var(--dim, #7f9cb0); line-height: 1.5; }
.mu-code { font-family: var(--font-display, sans-serif); font-size: calc(46px * var(--ui, 1)); letter-spacing: 0.32em; text-align: center; padding: 0.35em 0 0.35em 0.32em;
  color: var(--glow, #a7ddf5); background: rgba(0, 0, 0, 0.35); border: 1px solid var(--line-strong, rgba(150,200,235,.38)); user-select: all; }
.mu-etape input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); color: var(--ink, #d9ecf7); border: 1px solid var(--line-strong, rgba(150,200,235,.38));
  font-family: var(--font-display, sans-serif); font-size: calc(34px * var(--ui, 1)); letter-spacing: 0.3em; text-align: center; padding: 0.35em 0.2em; text-transform: uppercase; }
.mu-etape input:focus { outline: none; border-color: var(--glow, #a7ddf5); }
.mu-etape form { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.mu-rang { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mu-mot { min-height: 1.5em; line-height: 1.5; }
.mu-manettes { min-height: 1.5em; line-height: 1.5; color: var(--dim, #7f9cb0); font-family: var(--font-mono, monospace); font-size: 0.85em; }
.mu-mot[data-ton="alerte"] { color: var(--alert, #e0685c); }
.mu-mot[data-ton="bon"] { color: var(--valid, #3fd69b); }
.mu-detail { color: var(--dim, #7f9cb0); font-size: 0.78em; line-height: 1.5; margin: 0; word-break: break-word; user-select: all; }
.mu-jeu { position: absolute; inset: 0; }
.mu-jeu canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: none; }
.mu-ath { position: absolute; top: 14px; left: 14px; display: flex; flex-direction: column; gap: 8px; pointer-events: none; min-width: 230px; }
.mu-jauge { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; background: var(--panel, rgba(9,18,30,.82)); border: 1px solid var(--line, rgba(150,200,235,.16)); padding: 6px 10px; }
.mu-jauge i { width: 12px; height: 12px; border-radius: 50%; display: block; }
.mu-jauge .mu-barre { height: 6px; background: rgba(150, 200, 235, 0.12); position: relative; }
.mu-jauge .mu-barre u { position: absolute; left: 0; top: 0; bottom: 0; display: block; }
.mu-jauge small { grid-column: 2 / 4; color: var(--dim, #7f9cb0); font-size: 0.8em; letter-spacing: 0.06em; }
.mu-jauge b { font-weight: 400; font-variant-numeric: tabular-nums; }
/* (le stade du hockey met une foule sous ces textes : ils ont un fond) */
.mu-lien { color: var(--dim, #7f9cb0); font-size: 0.8em; padding: 2px 6px; font-variant-numeric: tabular-nums; background: rgba(3, 7, 14, 0.82); justify-self: start; }
.mu-actions { position: absolute; top: 14px; right: 14px; display: flex; gap: 8px; }
.mu-actions button { padding: 0.5em 0.9em; font-size: 0.85em; }
/* les boutons posés sur le jeu : un fond plein (la foule du stade passait au
   travers du fond commun des boutons) */
#multi .mu-actions button, #multi .mu-dash, #multi .mu-tenir { background: rgba(3, 7, 14, 0.88); }
.mu-tenir { position: absolute; right: 14px; bottom: 64px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 1em 1.3em !important;
  background: var(--panel, rgba(9,18,30,.82)) !important; touch-action: none; user-select: none; -webkit-user-select: none; }
.mu-tenir small { color: var(--dim, #7f9cb0); font-size: 0.7em; letter-spacing: 0.04em; }
.mu-tenir[data-tenu="1"] { background: rgba(167, 221, 245, 0.28) !important; border-color: var(--glow, #a7ddf5) !important; }
.mu-aide { position: absolute; left: 16px; right: 166px; bottom: 16px; text-align: center; color: var(--dim, #7f9cb0); pointer-events: none; font-size: 0.85em; padding: 6px 16px; background: rgba(3, 7, 14, 0.82); }
.mu-voile { position: absolute; inset: 0; background: rgba(2, 6, 12, 0.78); display: flex; align-items: center; justify-content: center; padding: 18px; }
.mu-voile[hidden] { display: none; }
.mu-voile div { max-width: 520px; display: flex; flex-direction: column; gap: 14px; text-align: center; line-height: 1.5; }
.mu-etiquette { position: absolute; transform: translate(-50%, -50%); pointer-events: none; font-family: var(--font-display, sans-serif); letter-spacing: 0.2em;
  font-size: calc(12px * var(--ui, 1)); text-shadow: 0 0 8px #000, 0 0 2px #000; transition: opacity 0.6s; }
/* LE VISEUR DE LA SOURIS : il remplace la croix du navigateur au-dessus du
   jeu — un trait fin noir et blanc, perdu sur la piste sombre et la foule du
   stade (le concepteur, 22/11 : « je ne sais plus où il est, et ce n'est pas
   pratique pour viser »). Un anneau à la couleur du joueur, cerné de noir
   pour ressortir sur tout fond, quatre crans, un point au centre ; et un
   trait en tirets qui le relie au bord du corps : on le retrouve en partant
   de soi, et on lit d'un coup d'œil où part le jet. */
.mu-viseur { position: absolute; width: 40px; height: 40px; margin: -20px 0 0 -20px; pointer-events: none; }
.mu-viseur[hidden], .mu-trait[hidden] { display: none; }
.mu-viseur svg { display: block; overflow: visible; }
.mu-viseur .mu-anneau { fill: none; transition: fill 0.08s; }
.mu-viseur[data-pousse="1"] .mu-anneau { fill: currentColor; fill-opacity: 0.28; }
.mu-viseur[data-pousse="1"] { filter: drop-shadow(0 0 6px currentColor); }
.mu-trait { position: absolute; inset: 0; pointer-events: none; }
.mu-trait svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.mu-trait line { stroke-linecap: round; }
.mu-trait .mu-trait-ombre { stroke: rgba(0, 0, 0, 0.45); stroke-width: 4; }
.mu-trait .mu-trait-jour { stroke: currentColor; stroke-width: 2; stroke-dasharray: 7 8; opacity: 0.55; }
.mu-reticule { position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border: 2px solid currentColor; border-radius: 50%; pointer-events: none; opacity: 0.75; }
.mu-reticule[hidden] { display: none; }
.mu-reticule[data-pousse="1"] { opacity: 1; background: currentColor; box-shadow: 0 0 12px currentColor; }
#multi button[data-pad="1"] { outline: 2px solid var(--accent, #8fd3ff); outline-offset: 3px; opacity: 1; }
.mu-codepad { display: flex; gap: 10px; justify-content: center; margin: 10px 0 4px; font-family: var(--font-display, sans-serif); font-size: calc(34px * var(--ui, 1)); }
.mu-codepad[hidden] { display: none; }
.mu-codepad span { width: 1.5em; padding: 0.2em 0; text-align: center; border: 1px solid var(--line, #24384a); }
.mu-codepad span[data-ici="1"] { border-color: var(--accent, #8fd3ff); box-shadow: inset 0 0 0 1px var(--accent, #8fd3ff); }
.mu-codepad + small { display: block; text-align: center; color: var(--dim, #7f9cb0); }
.mu-dash { position: absolute; right: 14px; bottom: 150px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 0.8em 1.3em !important; touch-action: none; user-select: none; }
.mu-dash small { color: var(--dim, #7f9cb0); font-size: 0.7em; letter-spacing: 0.04em; }
.mu-dash[data-pret="0"] { opacity: 0.35; }
.mu-glace { bottom: 232px; }
.mu-glace[hidden] { display: none; }
.mu-glace[data-prise="1"] { color: #e8f6ff; border-color: #e8f6ff; box-shadow: 0 0 14px rgba(232, 246, 255, 0.55); }
.mu-score em { font-style: normal; font-family: var(--font-mono, monospace); letter-spacing: 0.12em; color: var(--dim, #7f9cb0); }
.mu-decompte { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-family: var(--font-display, sans-serif); font-size: calc(140px * var(--ui, 1)); pointer-events: none; opacity: 0.85; text-shadow: 0 0 40px rgba(143, 211, 255, 0.5); }
.mu-decompte[hidden] { display: none; }
.mu-flash { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
.mu-flash[data-vif="1"] { animation: mu-flash 0.7s ease-out; }
@keyframes mu-flash { from { opacity: 0.42; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .mu-flash[data-vif="1"] { animation: none; } }
/* LE SALON, allégé (le concepteur, 22/11 : « le menu multi s'est alourdi ») :
   il empilait une phrase d'introduction, le profil, trois grandes cartes de
   mode et quatre grandes cartes d'action, chacune sa description. Il tient
   maintenant en trois temps — qui l'on est (une ligne), à quoi l'on joue
   (trois onglets, UNE ligne qui décrit le choix), comment l'on joue (quatre
   lignes, une indication courte) — et le reste se fait discret. */
.mu-accueil { gap: 1.6em; width: min(560px, calc(100% - 36px)); }
.mu-entete { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.mu-profil { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.mu-profil div { display: flex; align-items: center; gap: 7px; }
.mu-profil input { width: 9.5em; padding: 0.45em 0.7em; background: rgba(8, 16, 26, 0.9); color: var(--ink, #d9ecf7); border: 1px solid var(--line, #24384a); font: inherit; font-size: 0.85em; letter-spacing: 0.08em; }
.mu-profil input::placeholder { color: var(--dim, #7f9cb0); opacity: 0.7; }
.mu-bloc { display: flex; flex-direction: column; gap: 10px; }
.mu-rubrique { display: block; margin: 0; font-size: 0.72em; letter-spacing: 0.24em; color: var(--dim, #7f9cb0); }
/* (un message vide ne creuse pas le salon : il paraît quand il dit quelque chose) */
.mu-accueil .mu-mot:empty { display: none; }
.mu-desc { margin: 0; color: var(--dim, #7f9cb0); line-height: 1.5; min-height: 1.5em; }
.mu-jouer { display: flex; flex-direction: column; gap: 8px; }
#multi .mu-jouer button { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; text-align: left; padding: 1em 1.1em; }
.mu-jouer button b { font-family: var(--font-display, sans-serif); font-weight: 400; letter-spacing: 0.12em; }
.mu-jouer button span { color: var(--dim, #7f9cb0); letter-spacing: 0.02em; font-size: 0.82em; white-space: nowrap; }
.mu-pied { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.mu-pied .mu-manettes { flex: 1 1 100%; margin: 0; }
.mu-manettes:empty { display: none; }
.mu-pastille { width: 22px; height: 22px; padding: 0 !important; border-radius: 50% !important; background: var(--pastille) !important; border: 2px solid transparent !important; opacity: 0.55; }
.mu-pastille[data-choisi="1"] { opacity: 1; border-color: var(--ink, #d9ecf7) !important; box-shadow: 0 0 10px var(--pastille); }
.mu-voile h3 { margin: 0; font-family: var(--font-display, sans-serif); font-weight: 400; font-size: 2.4em; letter-spacing: 0.14em; }
.mu-voile h3:empty { display: none; }
.mu-modes { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
#multi .mu-modes button { padding: 0.75em 0.5em; opacity: 0.6; font-family: var(--font-display, sans-serif); letter-spacing: 0.16em; }
#multi .mu-modes button + button { border-left-width: 0; }
#multi .mu-modes button[data-choisi="1"] { color: var(--ink, #d9ecf7); background: rgba(143, 211, 255, 0.22); }
.mu-modes button[data-choisi="1"] { opacity: 1; border-color: var(--accent, #8fd3ff); box-shadow: inset 0 0 0 1px var(--accent, #8fd3ff); }
.mu-score { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; font-family: var(--font-display, sans-serif); background: rgba(3, 7, 14, 0.82); padding: 4px 18px 6px; }
.mu-score[hidden] { display: none; }
.mu-score div { display: flex; align-items: baseline; gap: 0.5em; font-size: 2.2em; letter-spacing: 0.06em; }
.mu-score div span { color: var(--dim, #7f9cb0); font-size: 0.6em; }
.mu-score small { letter-spacing: 0.18em; min-height: 1.2em; }
@media (max-width: 560px) { .mu-score { top: 150px; } #multi .mu-jouer button { flex-direction: column; gap: 4px; } }
`

/** Les poteaux du hockey, tels que l'écran les dessine et que les sons les
 *  écoutent. */
const POTEAUX_VUS = POTEAUX.map((q) => ({ x: q.x, y: q.y, rayon: RAYON_POTEAU }))

const GABARIT = `
<div class="mu-salon mu-accueil" data-page="salon">
  <header class="mu-entete">
    <h2 class="mu-titre">MULTI</h2>
    <div class="mu-profil">
      <input type="text" data-champ="pseudo" maxlength="${PSEUDO_MAX}" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="VOTRE NOM" aria-label="Votre nom (facultatif)">
      <div role="group" aria-label="Votre couleur">${PALETTE.map((_, k) => `<button type="button" class="mu-pastille" data-couleur="${k}" aria-label="${NOMS_COULEURS[k]}" style="--pastille:${couleurCss(k)}"></button>`).join('')}</div>
    </div>
  </header>
  <section class="mu-bloc">
    <span class="mu-rubrique">MODE</span>
    <div class="mu-modes" role="group" aria-label="Le mode de jeu">
      <button type="button" data-mode="1" data-choisi="1">HOCKEY</button>
      <button type="button" data-mode="2" data-choisi="0">SUMO</button>
      <button type="button" data-mode="0" data-choisi="0">LIBRE</button>
    </div>
    <p class="mu-desc" data-desc-mode></p>
  </section>
  <section class="mu-bloc">
    <span class="mu-rubrique">JOUER</span>
    <div class="mu-jouer">
      <button type="button" data-geste="robot"><b>CONTRE L’ORDINATEUR</b><span data-note-robot>tout de suite</span></button>
      <button type="button" data-geste="local"><b>À DEUX SUR CET ÉCRAN</b><span>une manette par joueur</span></button>
      <button type="button" data-geste="creer"><b>CRÉER UNE PARTIE EN LIGNE</b><span>vous donnez un code</span></button>
      <button type="button" data-geste="rejoindre"><b>REJOINDRE UNE PARTIE</b><span>vous tapez un code</span></button>
    </div>
  </section>
  <p class="mu-mot" data-mot="salon"></p>
  <footer class="mu-pied">
    <button type="button" class="mu-discret" data-geste="seul">S’ENTRAÎNER SEUL</button>
    <button type="button" class="mu-discret" data-geste="quitter">RETOUR</button>
    <p class="mu-manettes" data-manettes aria-live="polite"></p>
  </footer>
</div>

<div class="mu-salon" data-page="creation" hidden>
  <h2 class="mu-titre">CRÉER UNE PARTIE</h2>
  <div class="mu-etape">
    <h3>DONNEZ CE CODE À VOTRE AMI</h3>
    <p>Il le tape dans « Rejoindre une partie ». Ou envoyez-lui le lien : il arrive droit dans la partie. Rien ne presse — laissez cette page ouverte, la partie démarre toute seule quand il arrive.</p>
    <div class="mu-code" data-code aria-live="polite" aria-label="Code de la partie">·····</div>
    <div class="mu-rang"><button type="button" data-geste="copier-code" disabled>COPIER LE CODE</button><button type="button" data-geste="copier-lien" disabled>COPIER LE LIEN</button><span class="mu-mot" data-mot="copie"></span></div>
  </div>
  <p class="mu-mot" data-mot="creation"></p>
  <p class="mu-detail" data-detail="creation"></p>
  <div class="mu-rang"><button type="button" class="mu-discret" data-geste="retour">ANNULER</button></div>
</div>

<div class="mu-salon" data-page="jonction" hidden>
  <h2 class="mu-titre">REJOINDRE UNE PARTIE</h2>
  <div class="mu-etape">
    <h3>TAPEZ LE CODE DE LA PARTIE</h3>
    <p>Cinq caractères, donnés par la personne qui a créé la partie.</p>
    <form data-formulaire="code">
      <input type="text" data-champ="code" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="12" aria-label="Code de la partie" placeholder="·····">
      <div class="mu-codepad" data-codepad hidden></div><small data-codepad-aide hidden>MANETTE : ←→ la case · ↑↓ le caractère · A rejoindre · B annuler</small>
      <div class="mu-rang"><button type="submit" class="mu-fort" data-geste="valider-code">REJOINDRE</button></div>
    </form>
  </div>
  <p class="mu-mot" data-mot="jonction"></p>
  <p class="mu-detail" data-detail="jonction"></p>
  <div class="mu-rang"><button type="button" class="mu-discret" data-geste="retour">ANNULER</button></div>
</div>

<div class="mu-jeu" data-page="jeu" hidden>
  <canvas aria-label="La salle du multi"></canvas>
  <div class="mu-etiquette" data-etiquette hidden>VOUS</div>
  <div class="mu-trait" data-trait hidden><svg><line class="mu-trait-ombre"/><line class="mu-trait-jour"/></svg></div>
  <div class="mu-viseur" data-viseur hidden><svg viewBox="-20 -20 40 40" width="40" height="40">
    <g stroke="rgba(0,0,0,0.6)" stroke-width="5" stroke-linecap="round" fill="none"><circle r="11"/><path d="M0 -19V-14M0 19V14M-19 0H-14M19 0H14"/></g>
    <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle class="mu-anneau" r="11"/><path d="M0 -19V-14M0 19V14M-19 0H-14M19 0H14"/></g>
    <circle r="2.4" fill="currentColor" stroke="rgba(0,0,0,0.6)" stroke-width="1.4"/>
  </svg></div>
  <div class="mu-reticule" data-reticule hidden></div>
  <div class="mu-reticule" data-reticule2 hidden></div>
  <div class="mu-ath">
    <div class="mu-jauge" data-jauge="0"><i></i><div class="mu-barre"><u></u></div><b>100 %</b><small></small></div>
    <div class="mu-jauge" data-jauge="1"><i></i><div class="mu-barre"><u></u></div><b>100 %</b><small></small></div>
    <div class="mu-lien" data-lien></div>
  </div>
  <div class="mu-flash" data-flash></div>
  <div class="mu-score" data-score hidden><div><b data-but="0">0</b><span>—</span><b data-but="1">0</b></div><em data-chrono></em><small data-score-mot></small></div>
  <div class="mu-decompte" data-decompte hidden></div>
  <div class="mu-actions">
    <button type="button" data-geste="autre" hidden>L’AUTRE : FERMÉ</button>
    <button type="button" data-geste="changer" hidden>CHANGER DE CORPS</button>
    <button type="button" data-geste="recommencer">RECOMMENCER</button>
    <button type="button" data-geste="quitter-partie">QUITTER</button>
  </div>
  <button type="button" class="mu-dash mu-glace" data-tenir="glace" data-pret="1" aria-label="Glace (à maintenir)">GLACE<small>à maintenir · F</small></button>
  <button type="button" class="mu-dash" data-tenir="dash" data-pret="1" aria-label="Dash">DASH<small>maj</small></button>
  <button type="button" class="mu-tenir" data-tenir="ouvrir" aria-label="S’ouvrir (à maintenir)">S’OUVRIR<small>à maintenir · espace</small></button>
  <div class="mu-aide" data-aide></div>
  <div class="mu-voile" data-voile hidden><div><h3 data-voile-titre></h3><p data-voile-mot></p><span class="mu-rang" style="justify-content:center"><button type="button" class="mu-fort" data-geste="recommencer" data-revanche hidden>REVANCHE</button><button type="button" class="mu-fort" data-geste="retour-salon">REVENIR AU SALON</button></span></div></div>
</div>
`

export function creeEcranMulti(quitte: () => void): EcranMulti {
  let racine: HTMLDivElement | null = null
  let page: Page = 'salon'
  let role: Role = 'seul'
  let ouvert = false

  // ---- la partie en cours
  let rendu: RenduMulti | null = null
  let hote: Hote | null = null
  let miroir: Miroir | null = null
  let liaison: Liaison | null = null
  /** le code de la partie créée (pour le copier) */
  let codePartie = ''
  let cadre: Cadre = cadreSalle(SALLE, 16 / 9)
  /** Le mode choisi au salon, pour la partie qu'on crée. */
  // le hockey d'abord : c'est le jeu ; le mode libre est un bac à sable
  let modeChoisi: number = MODE_HOCKEY
  let rafId = 0
  let dernier = 0
  let resteEnvoi = 0
  let seqCommande = 0
  let seqCommandeRecue = -1
  /** le corps que pilote ce joueur */
  let moi = 0
  // le pointeur, en fraction de la toile
  const pointeur = { actif: false, fx: 0.5, fy: 0.5 }
  // S'OUVRIR se TIENT (espace, clic droit, ou le bouton à l'écran) : le
  // pacte ne vaut que tant qu'on y consent. Relâcher, c'est se refermer.
  const ouvre = { clavier: false, souris: false, bouton: false, manette: false }
  const jeMOuvre = (): boolean => ouvre.clavier || ouvre.souris || ouvre.bouton || ouvre.manette
  // LA MANETTE (manetteMulti.ts). Elle et le pointeur se passent la main :
  // le dernier des deux à avoir bougé commande.
  const manette = nouvelEtatManette()
  let mainManette = -1
  let mainPointeur = 0
  /** Le cœur du corps qu'on pilote, à la dernière image : la manette vise
   *  autour de lui. */
  const monCoeur = { x: 0, y: 0, connu: false }
  // CONTRE L'ORDINATEUR : le robot tient le corps 1 (robot.ts).
  let robot: Robot | null = null
  // À DEUX SUR CET ÉCRAN : le second joueur a sa manette, et son réticule.
  const manette2 = nouvelEtatManette()
  const coeur2 = { x: 0, y: 0, connu: false }
  /** Le cœur de chaque corps, relu à CHAQUE IMAGE sur les particules qu'on
   *  dessine (voir plus bas, où on le pose). */
  const coeursVus = new Float32Array(16)
  /** La souris est-elle au-dessus du jeu (et est-ce une souris : au doigt,
   *  le doigt montre où il est) ? */
  const souris = { dedans: false, estSouris: false }
  /** La présence du trait de visée, de 0 à 1 (presenceTrait, cadrage.ts). */
  let traitVu = 0
  // LES SONS (sonsMulti.ts) : ce qu'on entend se déduit de ce qu'on affiche,
  // d'une image à la suivante.
  const sons = new SonsMulti()
  let instantane: Instantane | null = null
  // LES PROFILS (profil.ts) : le mien, gardé dans ce navigateur, et celui de
  // l'autre, reçu au début de la partie. Tant qu'il n'est pas arrivé, l'autre
  // n'a pas de nom et prend la couleur voisine de la mienne.
  let monProfil: Profil = chargeProfil()
  let profilAutre: Profil | null = null
  /** Le rang, dans la palette, de la couleur du joueur 0 puis du joueur 1. */
  let couleurs: [number, number] = [0, 1]
  const teinte = (j: number): string => couleurCss(couleurs[j] ?? j)
  /** Recalcule qui porte quelle couleur. L'hôte est le joueur 0. */
  function accordeCouleurs(): void {
    const autre: Profil = profilAutre ?? { pseudo: '', couleur: (monProfil.couleur + 1) % PALETTE.length }
    couleurs = role === 'invite' ? couleursDeLaPartie(autre, monProfil) : couleursDeLaPartie(monProfil, autre)
    if (rendu) rendu.couleurs = couleurs
  }
  /** Au salon : le mode choisi est marqué, UNE ligne le décrit, et
   *  l'ordinateur ne s'offre qu'où il sait jouer (au mode libre il n'y a
   *  rien à gagner : il resterait immobile). */
  function peintMode(r: HTMLElement): void {
    for (const e of r.querySelectorAll<HTMLElement>('button[data-mode]')) e.dataset.choisi = Number(e.dataset.mode) === modeChoisi ? '1' : '0'
    r.querySelector<HTMLElement>('[data-desc-mode]')!.textContent =
      modeChoisi === MODE_HOCKEY
        ? `Un palet, deux cages, quatre poteaux. Le premier à ${BUTS_POUR_GAGNER} buts gagne.`
        : modeChoisi === MODE_SUMO
          ? `Un anneau qui se resserre : poussez l’autre dehors. ${MANCHES_POUR_GAGNER} manches gagnantes.`
          : 'Une grande salle vide, pour essayer les gestes. Rien à gagner.'
    const robot = r.querySelector<HTMLButtonElement>('[data-geste="robot"]')!
    robot.disabled = modeChoisi === MODE_LIBRE
    r.querySelector<HTMLElement>('[data-note-robot]')!.textContent = modeChoisi === MODE_LIBRE ? 'au hockey et au sumo' : 'tout de suite'
  }
  /** Au salon : la pastille de ma couleur est marquée. */
  function peintProfil(r: HTMLElement): void {
    for (const e of r.querySelectorAll<HTMLElement>('button[data-couleur]')) e.dataset.choisi = Number(e.dataset.couleur) === monProfil.couleur ? '1' : '0'
  }
  /** Le nom du joueur j, tel qu'on l'écrit à l'écran. */
  function nom(j: number): string {
    if (j === moi && role !== 'local') return monProfil.pseudo ? `${monProfil.pseudo.toUpperCase()} (VOUS)` : 'VOUS'
    if (role === 'local') return j === 0 ? 'JOUEUR 1' : 'JOUEUR 2'
    if (role === 'seul') return 'L’AUTRE CORPS'
    if (role === 'robot') return 'L’ORDINATEUR'
    return profilAutre?.pseudo ? profilAutre.pseudo.toUpperCase() : 'VOTRE AMI'
  }
  // LE DASH : son bouton, tenu au clavier (Maj), à l'écran ou à la manette —
  // c'est l'hôte qui en lit l'appui.
  const dash = { clavier: false, bouton: false, manette: false }
  // LA GLACE : tenue de même (F, son bouton, X ou Y à la manette)
  const glace = { clavier: false, bouton: false, manette: false }
  // LES ÉCLATS : l'onde qui part d'un choc, à l'écran (l'heure de sa naissance
  // en secondes). Ils naissent des mêmes événements que les sons.
  const eclats: { x: number; y: number; ne: number; force: number }[] = []
  /** SEUL : l'autre corps, qu'on ne pilote pas, est-il ouvert ? (un
   *  interrupteur, puisqu'on n'a qu'une main) */
  let autreOuvert = false
  // le pouls de la liaison
  let poulsId = 0
  let poulsParti = 0
  let poulsReste = 0
  let latenceMs = -1
  let debitReste = 0
  let debitRecus = 0
  let debitEnvoyes = 0
  let debitTexte = ''
  let etiquetteJusqua = 0
  /** images que l'hôte n'a pas envoyées parce que sa ligne ne suivait pas */
  let imagesSautees = 0
  let minuteurLiaison = 0

  const el = <T extends HTMLElement>(selecteur: string): T => {
    const e = racine?.querySelector<T>(selecteur)
    if (!e) throw new Error('écran multi : ' + selecteur + ' manque')
    return e
  }
  const mot = (nom: string, texte: string, ton: '' | 'alerte' | 'bon' = ''): void => {
    const e = el<HTMLElement>(`[data-mot="${nom}"]`)
    e.textContent = texte
    e.dataset.ton = ton
  }

  /** Le détail technique d'une panne, sous le message : c'est ce qu'il
   *  faut photographier pour qu'on sache ce qui s'est passé. */
  const detail = (ou: 'creation' | 'jonction', texte: string): void => {
    el<HTMLElement>(`[data-detail="${ou}"]`).textContent = texte ? 'Détail pour le dépannage — ' + texte : ''
  }

  function construit(): HTMLDivElement {
    const style = document.createElement('style')
    style.textContent = STYLE
    document.head.appendChild(style)
    const r = document.createElement('div')
    r.id = 'multi'
    r.hidden = true
    r.setAttribute('role', 'dialog')
    r.setAttribute('aria-label', 'Multi : jouer à deux')
    r.innerHTML = GABARIT
    document.body.appendChild(r)
    r.addEventListener('click', (ev) => {
      // le navigateur ne laisse sonner qu'après un geste : le premier clic
      sons.reveille()
      const pastille = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-couleur]')
      if (pastille) {
        monProfil = litProfil({ pseudo: monProfil.pseudo, couleur: Number(pastille.dataset.couleur) })
        gardeProfil(monProfil)
        peintProfil(r)
        return
      }
      const m = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]')
      if (m) {
        // le mode vaut pour la partie qu'on CRÉE (ou qu'on essaie seul) ;
        // celui qui rejoint l'apprend de l'hôte
        const voulu = Number(m.dataset.mode)
        modeChoisi = voulu === MODE_HOCKEY || voulu === MODE_SUMO ? voulu : MODE_LIBRE
        peintMode(r)
        return
      }
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-geste]')
      // le bouton d'un formulaire agit par « submit » (ci-dessous) : la
      // touche Entrée dans le champ fait alors le même geste que le clic
      if (b && !b.disabled && b.type !== 'submit') void geste(b.dataset.geste ?? '')
    })
    r.querySelector<HTMLFormElement>('[data-formulaire="code"]')!.addEventListener('submit', (ev) => {
      ev.preventDefault()
      void geste('valider-code')
    })
    const champPseudo = r.querySelector<HTMLInputElement>('[data-champ="pseudo"]')!
    champPseudo.value = monProfil.pseudo
    champPseudo.addEventListener('input', () => {
      monProfil = { pseudo: nettoiePseudo(champPseudo.value), couleur: monProfil.couleur }
      gardeProfil(monProfil)
    })
    peintProfil(r)
    peintMode(r)
    brancheToile(r.querySelector('canvas')!)
    const tenir = r.querySelector<HTMLButtonElement>('[data-tenir="ouvrir"]')!
    const tient = (oui: boolean): void => {
      ouvre.bouton = oui
    }
    tenir.addEventListener('pointerdown', (ev) => {
      tenir.setPointerCapture(ev.pointerId)
      tient(true)
      ev.preventDefault()
    })
    tenir.addEventListener('pointerup', () => tient(false))
    tenir.addEventListener('pointercancel', () => tient(false))
    tenir.addEventListener('contextmenu', (ev) => ev.preventDefault())
    const boutonDash = r.querySelector<HTMLButtonElement>('[data-tenir="dash"]')!
    boutonDash.addEventListener('pointerdown', (ev) => {
      boutonDash.setPointerCapture(ev.pointerId)
      dash.bouton = true
      ev.preventDefault()
    })
    boutonDash.addEventListener('pointerup', () => (dash.bouton = false))
    boutonDash.addEventListener('pointercancel', () => (dash.bouton = false))
    boutonDash.addEventListener('contextmenu', (ev) => ev.preventDefault())
    const boutonGlace = r.querySelector<HTMLButtonElement>('[data-tenir="glace"]')!
    boutonGlace.addEventListener('pointerdown', (ev) => {
      boutonGlace.setPointerCapture(ev.pointerId)
      glace.bouton = true
      ev.preventDefault()
    })
    boutonGlace.addEventListener('pointerup', () => (glace.bouton = false))
    boutonGlace.addEventListener('pointercancel', () => (glace.bouton = false))
    boutonGlace.addEventListener('contextmenu', (ev) => ev.preventDefault())
    // la fenêtre qui perd la main ne doit pas laisser un jet coincé ouvert
    window.addEventListener('blur', () => {
      pointeur.actif = false
      ouvre.clavier = false
      ouvre.souris = false
      ouvre.bouton = false
      dash.clavier = false
      dash.bouton = false
      glace.clavier = false
      glace.bouton = false
    })
    return r
  }

  function montre(p: Page): void {
    page = p
    if (!racine) return
    for (const e of racine.querySelectorAll<HTMLElement>('[data-page]')) e.hidden = e.dataset.page !== p
  }

  async function copie(texte: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texte)
      mot('copie', 'Copié.', 'bon')
    } catch {
      // presse-papiers refusé (permission, page non sécurisée) : le code
      // est écrit en grand, il se recopie à la main
      mot('copie', 'La copie est refusée par ce navigateur : recopiez le code à la main.')
    }
  }

  /** Le lien qui mène droit dans la partie : l'ami n'a rien à taper. */
  function lienPartie(): string {
    const u = new URL(location.href)
    u.search = ''
    u.hash = ''
    // (plus de « ?dev » : le multi est ouvert à tous)
    u.searchParams.set('multi', codePartie)
    return u.toString()
  }

  // ---- LA LIAISON ---------------------------------------------------------

  function brancheLiaison(l: Liaison): void {
    // une liaison précédente qui a échoué laisse la place (l'ami réessaie)
    if (liaison && liaison !== l) liaison.ferme()
    liaison = l
    seqCommandeRecue = -1
    l.surEtat = (etat) => surEtatLiaison(l, etat)
    l.surOrdre = (o) => surOrdre(o)
    l.surFlux = (octets) => {
      if (role === 'invite') miroir?.recoit(octets, performance.now())
      else if (role === 'hote') {
        const c = decodeCommande(octets)
        // une commande plus vieille que la dernière reçue est jetée
        if (c && c.seq > seqCommandeRecue) {
          seqCommandeRecue = c.seq
          hote?.commande(1, c.commande)
        }
      }
    }
    // la liaison a pu s'ouvrir (ou tomber) avant qu'on ne l'écoute
    if (l.etat !== 'attente') surEtatLiaison(l, l.etat)
  }

  function surEtatLiaison(l: Liaison, etat: EtatLiaison): void {
    if (l !== liaison) return
    if (etat === 'ouverte') {
      // la liaison reste « ouverte » à travers les reconnexions au relais :
      // on ne passe ici qu'UNE fois, et la partie n'est lancée qu'une fois
      l.envoieOrdre({ t: 'salut', version: VERSION_TRAME })
      l.envoieOrdre({ t: 'profil', pseudo: monProfil.pseudo, couleur: monProfil.couleur })
      lancePartie(role)
    } else if (etat === 'echec') {
      if (page === 'creation' || page === 'jonction') {
        mot(page, l.raison || 'La partie n’a pas pu s’établir.', 'alerte')
        detail(page, l.diagnostic())
        if (page === 'jonction') el<HTMLButtonElement>('[data-geste="valider-code"]').disabled = false
      }
    } else if (etat === 'coupee' && page === 'jeu') {
      voile((l.raison || 'La liaison est coupée.') + ' — ' + l.diagnostic())
    }
  }

  function surOrdre(o: Ordre): void {
    if (o.t === 'salut') {
      if (o.version !== VERSION_TRAME) voile('Vous n’avez pas la même version du jeu. Rechargez la page tous les deux, puis recommencez.')
    } else if (o.t === 'profil') {
      // ce qui vient de l'autre est remis au propre avant d'être montré
      profilAutre = litProfil(o)
      accordeCouleurs()
    } else if (o.t === 'recommence') {
      if (role === 'hote') recommence()
      else marqueEtiquette()
    } else if (o.t === 'pouls') {
      liaison?.envoieOrdre({ t: 'echo', id: o.id })
    } else if (o.t === 'echo') {
      if (o.id === poulsId) latenceMs = Math.round(performance.now() - poulsParti)
    } else if (o.t === 'adieu') {
      if (page === 'jeu') voile('L’autre joueur a quitté la partie.')
    }
  }

  function fermeLiaison(): void {
    profilAutre = null
    window.clearTimeout(minuteurLiaison)
    const l = liaison
    liaison = null
    l?.ferme()
  }

  // ---- LES GESTES ---------------------------------------------------------

  async function geste(g: string): Promise<void> {
    switch (g) {
      case 'quitter':
        api.ferme()
        quitte()
        return
      case 'seul':
        role = 'seul'
        lancePartie('seul')
        return
      case 'robot':
        role = 'robot'
        lancePartie('robot')
        return
      case 'local':
        role = 'local'
        lancePartie('local')
        return
      case 'creer':
        await ouvreCreation()
        return
      case 'rejoindre':
        ouvreJonction()
        return
      case 'retour':
      case 'retour-salon':
      case 'quitter-partie':
        arretePartie()
        fermeLiaison()
        montre('salon')
        return
      case 'copier-code':
        await copie(codePartie)
        return
      case 'copier-lien':
        await copie(lienPartie())
        return
      case 'valider-code':
        await valideCode()
        return
      case 'recommencer':
        if (role === 'invite') liaison?.envoieOrdre({ t: 'recommence' })
        else recommence()
        return
      case 'changer':
        // SEUL : le pointeur passe d'un corps à l'autre
        moi = moi === 0 ? 1 : 0
        marqueEtiquette()
        return
      case 'autre':
        // SEUL : ouvrir ou refermer le corps qu'on ne pilote pas
        autreOuvert = !autreOuvert
        peintAutre()
        return
    }
  }

  async function ouvreCreation(): Promise<void> {
    if (!liaisonPossible()) {
      mot('salon', 'Ce navigateur est trop ancien pour le multi. Essayez avec Chrome ou Edge à jour.', 'alerte')
      return
    }
    role = 'hote'
    fermeLiaison()
    montre('creation')
    codePartie = ''
    el<HTMLElement>('[data-code]').textContent = '·'.repeat(LONGUEUR_CODE)
    el<HTMLButtonElement>('[data-geste="copier-code"]').disabled = true
    el<HTMLButtonElement>('[data-geste="copier-lien"]').disabled = true
    mot('copie', '')
    detail('creation', '')
    mot('creation', 'Ouverture de la partie…')
    const c = await creePartie(adresseRelais(location.search))
    // l'écran a pu être quitté pendant l'ouverture
    if (page !== 'creation' || role !== 'hote') {
      if (c.ok) c.accueil.liaison.ferme()
      return
    }
    if (!c.ok) {
      mot('creation', c.raison, 'alerte')
      detail('creation', c.detail)
      return
    }
    codePartie = c.accueil.code
    el<HTMLElement>('[data-code]').textContent = codePartie
    el<HTMLButtonElement>('[data-geste="copier-code"]').disabled = false
    el<HTMLButtonElement>('[data-geste="copier-lien"]').disabled = false
    mot('creation', 'En attente de votre ami…')
    // la liaison est déjà là : elle s'ouvre quand l'ami prend place
    brancheLiaison(c.accueil.liaison)
  }

  function ouvreJonction(code = ''): void {
    if (!liaisonPossible()) {
      mot('salon', 'Ce navigateur est trop ancien pour le multi. Essayez avec Chrome ou Edge à jour.', 'alerte')
      return
    }
    role = 'invite'
    fermeLiaison()
    montre('jonction')
    const champ = el<HTMLInputElement>('[data-champ="code"]')
    champ.value = code
    casePad = 0
    el<HTMLElement>('[data-codepad]').hidden = true
    el<HTMLElement>('[data-codepad-aide]').hidden = true
    el<HTMLButtonElement>('[data-geste="valider-code"]').disabled = false
    mot('jonction', '')
    detail('jonction', '')
    if (code) void valideCode()
    else champ.focus()
  }

  async function valideCode(): Promise<void> {
    const bouton = el<HTMLButtonElement>('[data-geste="valider-code"]')
    if (bouton.disabled) return
    const lu = litCodePartie(el<HTMLInputElement>('[data-champ="code"]').value)
    if (!lu.ok) {
      mot('jonction', lu.raison, 'alerte')
      return
    }
    bouton.disabled = true
    detail('jonction', '')
    mot('jonction', 'Recherche de la partie…')
    fermeLiaison()
    const j = await rejointPartie(adresseRelais(location.search), lu.code)
    if (page !== 'jonction' || role !== 'invite') {
      if (j.ok) j.liaison.ferme()
      return
    }
    if (!j.ok) {
      bouton.disabled = false
      mot('jonction', j.raison, 'alerte')
      detail('jonction', j.detail)
      return
    }
    mot('jonction', 'Partie trouvée…')
    brancheLiaison(j.liaison)
  }

  // ---- LA PARTIE ----------------------------------------------------------

  /** Un message qui barre l'écran. Avec un `titre`, c'est la FIN d'un match :
   *  le résultat en grand, et le bouton de la revanche. */
  function voile(texte: string, titre = ''): void {
    el<HTMLElement>('[data-voile-titre]').textContent = titre
    el<HTMLElement>('[data-voile-mot]').textContent = texte
    el<HTMLElement>('[data-revanche]').hidden = titre === ''
    el<HTMLElement>('[data-voile]').hidden = false
    finAffichee = titre !== ''
  }
  /** Le voile montre-t-il la fin d'un match ? (Lui seul se retire tout seul,
   *  quand la revanche commence ; un message d'erreur reste.) */
  let finAffichee = false

  function peintAutre(): void {
    el<HTMLButtonElement>('[data-geste="autre"]').textContent = autreOuvert ? 'L’AUTRE : OUVERT' : 'L’AUTRE : FERMÉ'
  }

  function marqueEtiquette(): void {
    etiquetteJusqua = performance.now() + 5000
  }

  function recommence(): void {
    hote?.recommence()
    seqCommandeRecue = -1
    liaison?.envoieOrdre({ t: 'recommence' })
    marqueEtiquette()
  }

  function lancePartie(r: Role): void {
    arretePartie()
    role = r
    montre('jeu')
    el<HTMLElement>('[data-voile]').hidden = true
    finAffichee = false
    el<HTMLButtonElement>('[data-geste="changer"]').hidden = r !== 'seul'
    moi = r === 'invite' ? 1 : 0
    try {
      rendu = new RenduMulti(el<HTMLCanvasElement>('canvas'), CAPACITE)
    } catch (e) {
      console.error('multi : rendu', e)
      voile('L’affichage n’a pas pu démarrer sur cette machine (WebGL2 indisponible).')
      return
    }
    if (r === 'invite') {
      miroir = new Miroir()
    } else {
      hote = new Hote(2, undefined, modeChoisi)
    }
    robot = r === 'robot' ? new Robot(1) : null
    accordeCouleurs()
    aideDuMode = -1
    instantane = null
    eclats.length = 0
    dash.clavier = false
    dash.bouton = false
    glace.clavier = false
    glace.bouton = false
    el<HTMLElement>('[data-score]').hidden = true
    el<HTMLButtonElement>('[data-geste="autre"]').hidden = r !== 'seul'
    ouvre.clavier = false
    ouvre.souris = false
    ouvre.bouton = false
    autreOuvert = false
    peintAutre()
    cadre = cadreSalle(hote?.salle ?? SALLE, rendu.aspect())
    seqCommande = 0
    seqCommandeRecue = -1
    latenceMs = -1
    poulsReste = 0
    debitReste = 0
    debitRecus = liaison?.recus ?? 0
    debitEnvoyes = liaison?.envoyes ?? 0
    debitTexte = ''
    imagesSautees = 0
    resteEnvoi = 0
    pointeur.actif = false
    marqueEtiquette()
    dernier = performance.now()
    if (r === 'hote') lanceBattement()
    rafId = requestAnimationFrame(image)
  }

  function arretePartie(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    arreteBattement()
    sons.silence()
    const avaitRendu = rendu !== null
    rendu?.libere()
    rendu = null
    hote = null
    miroir = null
    // libérer le rendu rend son contexte graphique : la toile qui l'a porté
    // n'en donnera plus. Une toile neuve pour la prochaine partie.
    const vieille = racine?.querySelector('canvas')
    if (vieille && avaitRendu) {
      const neuve = vieille.cloneNode(false) as HTMLCanvasElement
      vieille.replaceWith(neuve)
      brancheToile(neuve)
    }
  }

  /** Le pointeur sur la toile : maintenir pousse, relâcher arrête. */
  function brancheToile(toile: HTMLCanvasElement): void {
    const suit = (ev: PointerEvent): void => {
      const b = toile.getBoundingClientRect()
      pointeur.fx = (ev.clientX - b.left) / Math.max(1, b.width)
      pointeur.fy = (ev.clientY - b.top) / Math.max(1, b.height)
      mainPointeur = performance.now()
      souris.dedans = true
      souris.estSouris = ev.pointerType === 'mouse'
      // le viseur suit la souris À L'ÉVÉNEMENT, sans attendre l'image : un
      // viseur en retard d'une image sur la main se sent
      placeViseur()
    }
    // Les boutons se lisent dans le masque de CHAQUE événement : presser le
    // clic droit pendant que le gauche est tenu n'envoie pas de « pointerdown »
    // mais un « pointermove » — c'est le masque qui dit vrai. Gauche (ou le
    // doigt) : pousser. Droit : s'ouvrir.
    const lit = (ev: PointerEvent): void => {
      suit(ev)
      pointeur.actif = (ev.buttons & 1) !== 0
      ouvre.souris = ev.pointerType === 'mouse' && (ev.buttons & 2) !== 0
    }
    const lache = (): void => {
      pointeur.actif = false
      ouvre.souris = false
    }
    toile.addEventListener('pointerdown', (ev) => {
      toile.setPointerCapture(ev.pointerId)
      lit(ev)
      ev.preventDefault()
    })
    toile.addEventListener('pointermove', lit)
    toile.addEventListener('pointerup', lit)
    toile.addEventListener('pointercancel', lache)
    toile.addEventListener('pointerleave', () => {
      souris.dedans = false
      placeViseur()
    })
    toile.addEventListener('contextmenu', (ev) => ev.preventDefault())
  }

  // LE BATTEMENT D'ARRIÈRE-PLAN. Un navigateur n'appelle plus
  // requestAnimationFrame pour une fenêtre cachée (un alt-tab qui la
  // recouvre, un autre onglet) et ralentit ses minuteries à une par seconde :
  // la simulation de l'hôte s'arrêterait, et l'invité regarderait une image
  // figée. Les minuteries d'un WORKER, elles, ne sont pas ralenties : il bat
  // soixante fois par seconde, et quand la page est cachée c'est lui qui
  // fait avancer la partie — sans dessiner, personne ne regarde.
  let battement: Worker | null = null
  let battementUrl = ''
  function lanceBattement(): void {
    if (battement) return
    try {
      battementUrl = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},16)'], { type: 'text/javascript' }))
      battement = new Worker(battementUrl)
      battement.onmessage = () => {
        if (document.hidden && rendu && role === 'hote') tour(performance.now(), false)
      }
    } catch {
      // pas de worker ici : la partie se figera fenêtre cachée, rien de plus
      battement = null
    }
  }
  function arreteBattement(): void {
    battement?.terminate()
    battement = null
    if (battementUrl) URL.revokeObjectURL(battementUrl)
    battementUrl = ''
  }

  function image(maintenant: number): void {
    rafId = requestAnimationFrame(image)
    tour(maintenant, true)
  }

  /** Un tour de partie. `dessine` est faux quand la fenêtre est cachée :
   *  on simule et on envoie, on ne peint rien. */
  function tour(maintenant: number, dessine: boolean): void {
    if (!rendu) return
    const dt = Math.min(0.1, Math.max(0, (maintenant - dernier) / 1000))
    dernier = maintenant

    // la commande de CE joueur, dans le monde
    const vise = ecranVersMonde(cadre, pointeur.fx, pointeur.fy)
    // À DEUX SUR CET ÉCRAN : avec deux manettes, chacun la sienne ; avec une
    // seule, elle est au second joueur et le premier garde souris et clavier
    const pads = padsBranches()
    const [padDuPremier, padDuSecond] = role === 'local' ? manettesDuLocal(pads) : [pads[0] ?? null, null]
    litManette(padDuPremier, manette)
    if (manette.vie) {
      mainManette = maintenant
      sons.reveille()
    }
    const aLaManette = manette.connectee && monCoeur.connu && mainManette > mainPointeur
    ouvre.manette = aLaManette && manette.ouvert
    dash.manette = aLaManette && manette.dash
    glace.manette = aLaManette && manette.glace
    let commande: Commande
    if (aLaManette) {
      commande = commandeManette(manette, monCoeur.x, monCoeur.y)
      commande.ouvert = jeMOuvre()
      if (manette.recommence) {
        if (role === 'invite') liaison?.envoieOrdre({ t: 'recommence' })
        else recommence()
      }
      if (manette.quitte) {
        void geste('quitter-partie')
        return
      }
    } else {
      commande = { pousse: pointeur.actif, ouvert: jeMOuvre(), x: vise.x, y: vise.y }
    }
    commande.dash = dash.clavier || dash.bouton || dash.manette
    commande.glace = glace.clavier || glace.bouton || glace.manette
    // onglet à l'arrière-plan : on ne pousse ni ne s'ouvre à l'aveugle
    if (!dessine) {
      commande.pousse = false
      commande.ouvert = false
      commande.dash = false
      commande.glace = false
    }

    let particules: Particules
    let corps: CorpsTrame[]
    let jeu: JeuTrame | null
    let salle: Bornes
    let commande2: Commande | null = null
    if (role === 'invite') {
      liaison?.envoieFlux(encodeCommande(++seqCommande, commande))
      particules = miroir!.vue(maintenant)
      corps = miroir!.corps
      jeu = miroir!.jeu(maintenant)
      salle = miroir!.salle
    } else {
      const h = hote!
      h.commande(moi, commande)
      // SEUL : le corps qu'on ne pilote pas ne pousse pas, et tient l'état
      // de son interrupteur ; il vise où vise le pointeur (au hockey, c'est
      // par là qu'il lancerait le palet)
      if (role === 'seul') h.commande(1 - moi, { pousse: false, ouvert: autreOuvert, x: commande.x, y: commande.y })
      // CONTRE L'ORDINATEUR : le robot joue le corps 1, avec les commandes
      // d'un joueur
      if (robot) h.commande(1, dessine ? robot.commande(h, dt) : { pousse: false, ouvert: false, x: 0, y: 0 })
      // À DEUX SUR CET ÉCRAN : la manette du second joueur
      if (role === 'local') {
        litManette(padDuSecond, manette2)
        commande2 = manette2.connectee && coeur2.connu && dessine ? commandeManette(manette2, coeur2.x, coeur2.y) : null
        h.commande(1, commande2 ?? { pousse: false, ouvert: false, x: 0, y: 0 })
      }
      h.avance(dt)
      if (role === 'hote' && liaison) {
        resteEnvoi -= dt
        if (resteEnvoi <= 0) {
          resteEnvoi += 1 / CADENCE_ETAT
          if (resteEnvoi < 0) resteEnvoi = 0
          // ligne engorgée : on saute l'image ENTIÈRE (un morceau seul ne
          // sert à rien) — la cadence s'ajuste à ce que la ligne porte
          if (liaison.engorgee) imagesSautees++
          else for (const morceau of h.image()) liaison.envoieFlux(morceau)
        }
      }
      particules = h.vue()
      corps = h.corps()
      jeu = h.jeu()
      salle = h.salle
    }

    // ---- les sons : ce qui vient d'arriver, puis ce qui dure
    const apres: Instantane = {
      t: role === 'invite' ? miroir!.tSim : hote!.tSim,
      corps,
      jeu,
      salle,
      rayonPalet: jeu ? RAYON_PALET : 0,
      poteaux: jeu?.mode === MODE_HOCKEY ? POTEAUX_VUS : undefined,
    }
    const entendus = entend(instantane, apres, moi)
    instantane = apres
    if (dessine) {
      for (const son of entendus) {
        // (un choc trop rapproché du précédent est tu : ni son, ni onde)
        if (!sons.joue(son, (son.x - cadre.cx) / cadre.demiL, maintenant)) continue
        // un choc, une onde ; un but, l'écran qui s'illumine à la couleur du buteur
        if (son.type === 'paroi' || son.type === 'choc-palet' || son.type === 'contact' || son.type === 'dash' || son.type === 'gel' || son.type === 'lancer' || son.type === 'prise') {
          if (eclats.length >= ECLATS_MAX) eclats.shift()
          eclats.push({ x: son.x, y: son.y, ne: maintenant / 1000, force: Math.max(0.3, son.force) })
        } else if ((son.type === 'but' || son.type === 'fin') && jeu && jeu.buteur >= 0) {
          const flash = el<HTMLElement>('[data-flash]')
          flash.style.background = teinte(jeu.buteur)
          flash.dataset.vif = '0'
          void flash.offsetWidth // relance l'animation
          flash.dataset.vif = '1'
        }
      }
      // le jet : le sien plein, celui de l'autre en retrait
      const jet = corps[moi]?.pousse ? 1 : corps.some((c) => c.pousse) ? 0.4 : 0
      sons.continu(jet, jeu && jeu.tenuPar === moi ? jeu.charge : -1)
    } else {
      sons.silence()
    }
    // LE CŒUR QUE LA MANETTE VISE : celui des particules qu'on dessine, et
    // non celui de l'état du corps. Le réticule était accroché à l'état
    // (le concepteur, 22/11 : « le curseur de direction n'est pas fluide, il
    // saccade, alors que le reste est fluide ») : l'hôte ne recalcule ce
    // centre qu'un pas sur cinq (le recensement des corps, 24 fois par
    // seconde), l'invité ne le reçoit que vingt fois par seconde, et l'écran
    // en peint soixante — le corps glissait, le réticule avançait par sauts
    // (mesuré : 179 u/s en moyenne, de 0 à 674 d'une image à l'autre). Les
    // particules, elles, bougent à chaque image (chez l'invité, prolongées
    // par leur vitesse) : leur centre aussi.
    coeursDe(particules, coeursVus)
    const poseCoeur = (cible: { x: number; y: number; connu: boolean }, c: CorpsTrame | undefined, j: number): void => {
      cible.connu = !!c && !c.disperse
      if (!c) return
      const vu = coeursVus[j * 4 + 3] > 0
      cible.x = vu ? coeursVus[j * 4] : c.x
      cible.y = vu ? coeursVus[j * 4 + 1] : c.y
    }
    poseCoeur(coeur2, corps[1], 1)
    poseCoeur(monCoeur, corps[moi], moi)
    if (!dessine) return
    // AU HOCKEY on voit tout le terrain, toujours : il faut lire les deux
    // cages et le palet d'un coup d'œil, pas seulement les deux corps
    // …avec de la place au-dessus pour le score et les jauges, et dessous
    // pour l'aide : ils mordaient sur le terrain
    // (au HOCKEY, plus large encore : le terrain est dans un STADE, et c'est
    // l'arène autour — sa rambarde, ses gradins — qui le dit ; à 150 u au-
    // dessus, on n'en voyait que la rambarde et un rang de spectateurs. La
    // piste y perd 9 % de sa taille à l'écran.)
    const stade = jeu?.mode === MODE_HOCKEY
    const terrainEtMarges: Bornes = stade
      ? { minX: salle.minX - 150, minY: salle.minY - 300, maxX: salle.maxX + 150, maxY: salle.maxY + 260 }
      : { minX: salle.minX, minY: salle.minY - 150, maxX: salle.maxX, maxY: salle.maxY + 90 }
    const voulu = jeu ? cadreSalle(terrainEtMarges, rendu.aspect()) : corps.length > 0 ? cadreVoulu(corps, salle, rendu.aspect()) : cadre
    cadre = suitCadre(cadre, voulu, dt)
    let scene: SceneHockey | null = null
    if (jeu) {
      const hockey = jeu.mode === MODE_HOCKEY
      const porteur = corps[jeu.tenuPar]
      scene = {
        // la patinoire, ses cercles et ses cages : au hockey seulement
        coins: hockey ? RAYON_COINS : 0,
        miseEnJeu: { decalage: CERCLE_DECALAGE, ecart: CERCLE_ECART, rayon: RAYON_CERCLE },
        cage: { ligne: hockey ? LIGNE_BUT : 0, profondeur: PROFONDEUR_CAGE, demiOuverture: DEMI_OUVERTURE, demiFond: DEMI_FOND, epaisseur: EPAISSEUR_CAGE },
        // l'anneau : au sumo seulement
        anneau: jeu.mode === MODE_SUMO ? { x: (ARENE.minX + ARENE.maxX) / 2, y: (ARENE.minY + ARENE.maxY) / 2, rayon: jeu.anneau } : null,
        palet: jeu.paletActif ? { x: jeu.paletX, y: jeu.paletY, rayon: RAYON_PALET, vx: jeu.paletVx, vy: jeu.paletVy } : null,
        poteaux: hockey ? POTEAUX_VUS : [],
        porteur: porteur ? jeu.tenuPar : -1,
        charge: jeu.charge,
        viseeX: porteur?.viseeX ?? 0,
        viseeY: porteur?.viseeY ?? 0,
        // c'est moi qui le tiens, à la souris : mon trait le remplace
        traitPorteur: !(jeu.tenuPar === moi && souris.dedans && souris.estSouris && !aLaManette),
      }
    }
    while (eclats.length > 0 && maintenant / 1000 - eclats[0].ne >= DUREE_ECLAT) eclats.shift()
    const ondes: Eclat[] = eclats.map((e) => ({ x: e.x, y: e.y, age: maintenant / 1000 - e.ne, force: e.force }))
    rendu.dessine(particules, cadre, salle, corps, maintenant / 1000, scene, ondes)
    el<HTMLElement>('[data-tenir="dash"]').dataset.pret = corps[moi]?.dashPret === false ? '0' : '1'
    const boutonGlace = el<HTMLElement>('[data-tenir="glace"]')
    boutonGlace.hidden = jeu?.mode === MODE_SUMO
    boutonGlace.dataset.prise = corps[moi]?.glace ? '1' : '0'
    boutonGlace.dataset.pret = corps[moi]?.glacePrete === false && !corps[moi]?.glace ? '0' : '1'
    // le réticule se peint autour du cœur de CETTE image (la commande, elle,
    // est partie avec celui de l'image d'avant : un réticule en retard d'une
    // image traînerait derrière un corps rapide)
    peintReticule('[data-reticule]', aLaManette, aLaManette ? commandeManette(manette, monCoeur.x, monCoeur.y) : commande, moi)
    // le viseur de la souris et son trait, à la couleur du joueur ; pleins
    // quand on pousse
    placeViseur()
    const viseur = el<HTMLElement>('[data-viseur]')
    const trait = el<HTMLElement>('[data-trait]')
    viseur.style.color = trait.style.color = teinte(moi)
    viseur.dataset.pousse = commande.pousse && !aLaManette ? '1' : '0'
    // le trait ne paraît que quand je tiens le palet (le tir se vise)
    const jeTiens = jeu?.mode === MODE_HOCKEY && jeu.tenuPar === moi
    traitVu = presenceTrait(traitVu, !jeTiens || aLaManette, dt)
    trait.style.opacity = traitVu.toFixed(3)
    peintTrait()
    peintReticule('[data-reticule2]', commande2 !== null, commande2 ? commandeManette(manette2, coeur2.x, coeur2.y) : commande, 1)
    el<HTMLElement>('[data-tenir="ouvrir"]').hidden = jeu?.mode === MODE_SUMO
    peintAide(jeu ? jeu.mode : MODE_LIBRE)
    peintScore(jeu)
    peintAth(corps, maintenant, dt)
    el<HTMLElement>('[data-tenir="ouvrir"]').dataset.tenu = jeMOuvre() ? '1' : '0'
  }

  // ---- LA MANETTE AU SALON -------------------------------------------------
  // En jeu la manette joue ; au salon (et sur un message qui barre l'écran)
  // elle passe d'un bouton à l'autre. Elle se lit sur une minuterie : le
  // salon n'a pas de boucle d'image.
  const menu = nouvelEtatMenu()
  let menuId = 0
  let boutonPad: HTMLButtonElement | null = null
  /** REJOINDRE à la manette : la case du code qu'on compose. */
  let casePad = 0

  function marquePad(b: HTMLButtonElement | null): void {
    if (boutonPad === b) return
    if (boutonPad) delete boutonPad.dataset.pad
    boutonPad = b
    if (b) b.dataset.pad = '1'
  }

  /** Les boutons qu'on peut atteindre : ceux de la page montrée — ou du
   *  message, s'il y en a un devant. */
  function boutonsDuSalon(): HTMLButtonElement[] {
    if (!racine) return []
    const zone = page === 'jeu' ? '[data-voile]' : `[data-page="${page}"]`
    return [...racine.querySelectorAll<HTMLButtonElement>(`${zone} button`)].filter((b) => !b.disabled && b.offsetParent !== null)
  }

  /** Le code qu'on compose à la croix, case par case. */
  function composeCode(dx: number, dy: number): void {
    const champ = el<HTMLInputElement>('[data-champ="code"]')
    const lu = champ.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    // (une case vide n'est pas un caractère de l'alphabet : « includes('') »
    // dit vrai pour toute chaîne, d'où le test de longueur)
    const cases = Array.from({ length: LONGUEUR_CODE }, (_, i) => {
      const c = lu[i] ?? ''
      return c.length === 1 && ALPHABET_CODE.includes(c) ? c : ALPHABET_CODE[0]
    })
    if (dx !== 0) casePad = Math.min(LONGUEUR_CODE - 1, Math.max(0, casePad + dx))
    // vers le haut, on avance dans l'alphabet
    if (dy !== 0) cases[casePad] = defileCaractere(ALPHABET_CODE, cases[casePad], -dy)
    champ.value = cases.join('')
    const boite = el<HTMLElement>('[data-codepad]')
    boite.hidden = false
    el<HTMLElement>('[data-codepad-aide]').hidden = false
    boite.replaceChildren(
      ...cases.map((c, i) => {
        const e = document.createElement('span')
        e.textContent = c
        e.dataset.ici = i === casePad ? '1' : '0'
        return e
      }),
    )
  }

  function tourMenu(maintenant: number): void {
    // au salon, ce que le navigateur voit des manettes (le diagnostic)
    if (racine && page === 'salon') {
      const ligne = el<HTMLElement>('[data-manettes]')
      // (aucune manette vue : rien — un joueur à la souris n'a pas à lire
      // qu'il pourrait en brancher une ; « à deux sur cet écran » le dit)
      const vus = padsVus()
      const texte = vus !== null && vus.length === 0 ? '' : ligneManettes(vus)
      if (ligne.textContent !== texte) ligne.textContent = texte
    }
    const pad = padCourant()
    const g = litMenu(pad, menu, maintenant)
    if (!pad || !racine) return
    if (g.valide || g.retour) sons.reveille()
    const barre = page === 'jeu' && !el<HTMLElement>('[data-voile]').hidden
    if (page === 'jeu' && !barre) {
      marquePad(null) // en jeu, la manette joue
      return
    }
    const clique = (selecteur: string): boolean => {
      const zone = page === 'jeu' ? '[data-voile]' : `[data-page="${page}"]`
      const b = racine!.querySelector<HTMLButtonElement>(`${zone} ${selecteur}`)
      if (!b || b.disabled) return false
      b.click()
      return true
    }
    if (g.retour) {
      marquePad(null)
      if (!clique('[data-geste="retour"]') && !clique('[data-geste="retour-salon"]')) clique('[data-geste="quitter"]')
      return
    }
    if (page === 'jonction') {
      if (g.dx !== 0 || g.dy !== 0) composeCode(g.dx, g.dy)
      if (g.valide) clique('[data-geste="valider-code"]')
      return
    }
    const boutons = boutonsDuSalon()
    if (boutons.length === 0) return
    const courant = boutonPad && boutons.includes(boutonPad) ? boutonPad : null
    if (g.dx !== 0 || g.dy !== 0) {
      if (!courant) {
        marquePad(boutons[0])
      } else {
        const centre = (b: HTMLElement): { x: number; y: number } => {
          const r = b.getBoundingClientRect()
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        }
        const i = voisinMenu(centre(courant), boutons.map(centre), g.dx, g.dy)
        if (i >= 0) marquePad(boutons[i])
      }
    }
    if (g.valide) {
      if (courant) courant.click()
      else marquePad(boutons[0])
    }
  }

  /** Les manettes que le navigateur montre, les « standard » d'abord — ou
   *  null s'il ne donne pas accès aux manettes du tout (voir le diagnostic,
   *  manetteMulti.ts). */
  function padsVus(): PadVu[] | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
    let tous: (Gamepad | null)[]
    try {
      tous = [...navigator.getGamepads()]
    } catch {
      // une politique du document peut interdire l'API : elle jette alors
      return null
    }
    const branchees = tous.filter((gp): gp is Gamepad => !!gp && gp.connected)
    return [...branchees.filter((gp) => gp.mapping === 'standard'), ...branchees.filter((gp) => gp.mapping !== 'standard')]
  }
  /** Les manettes branchées sur cette machine (aucune si l'API manque). */
  function padsBranches(): PadVu[] {
    return padsVus() ?? []
  }
  /** La première d'entre elles (le salon se parcourt avec elle), ou null. */
  function padCourant(): PadLu | null {
    return padsBranches()[0] ?? null
  }

  /** Le viseur de la souris : où est le pointeur. Montré seulement quand
   *  c'est la souris qui a la main (la manette a son réticule). */
  function placeViseur(): void {
    if (!racine) return
    const v = el<HTMLElement>('[data-viseur]')
    const voir = page === 'jeu' && souris.dedans && souris.estSouris && !(manette.connectee && mainManette > mainPointeur)
    if (!voir) {
      if (!v.hidden) v.hidden = true
      return
    }
    v.hidden = false
    v.style.left = `${(pointeur.fx * 100).toFixed(3)}%`
    v.style.top = `${(pointeur.fy * 100).toFixed(3)}%`
  }
  /** Le trait de visée : du bord de MON corps au viseur (voir traitDeVisee). */
  function peintTrait(): void {
    const t = el<HTMLElement>('[data-trait]')
    const v = el<HTMLElement>('[data-viseur]')
    const rayon = coeursVus[moi * 4 + 3] > 0 ? coeursVus[moi * 4 + 2] : 0
    const vise = ecranVersMonde(cadre, pointeur.fx, pointeur.fy)
    const seg = !v.hidden && traitVu > 0 && monCoeur.connu && rayon > 0 ? traitDeVisee(monCoeur.x, monCoeur.y, rayon, vise.x, vise.y) : null
    if (!seg) {
      if (!t.hidden) t.hidden = true
      return
    }
    const a = mondeVersEcran(cadre, seg.x1, seg.y1)
    const b = mondeVersEcran(cadre, seg.x2, seg.y2)
    t.hidden = false
    for (const l of t.querySelectorAll('line')) {
      l.setAttribute('x1', `${(a.fx * 100).toFixed(3)}%`)
      l.setAttribute('y1', `${(a.fy * 100).toFixed(3)}%`)
      l.setAttribute('x2', `${(b.fx * 100).toFixed(3)}%`)
      l.setAttribute('y2', `${(b.fy * 100).toFixed(3)}%`)
    }
  }

  /** À la manette il n'y a pas de pointeur à l'écran : un réticule montre
   *  où l'on va (et par où partirait le palet), à la couleur du joueur. */
  function peintReticule(selecteur: string, visible: boolean, commande: Commande, joueur: number): void {
    const r = el<HTMLElement>(selecteur)
    if (!visible) {
      if (!r.hidden) r.hidden = true
      return
    }
    const e = mondeVersEcran(cadre, commande.x, commande.y)
    r.hidden = false
    // au millième de pour cent : au centième, sur un terrain de 3 000 u, le
    // réticule avançait par crans d'un demi-pixel monde
    r.style.left = `${(e.fx * 100).toFixed(3)}%`
    r.style.top = `${(e.fy * 100).toFixed(3)}%`
    r.style.color = teinte(joueur)
    r.dataset.pousse = commande.pousse ? '1' : '0'
  }

  /** L'aide du bas d'écran suit le mode — que l'invité n'apprend qu'à la
   *  première image reçue. */
  let aideDuMode = -1
  function peintAide(mode: number): void {
    if (mode === aideDuMode) return
    aideDuMode = mode
    const commun = 'Clic maintenu : la matière part vers le pointeur, le corps à l’opposé — sur votre corps, il se rassemble. '
    const propre =
      mode === MODE_SUMO
        ? 'Poussez l’autre HORS de l’anneau, qui se resserre : son cœur dehors, la manche est à vous. MAJ : un dash. On ne s’ouvre pas au sumo.'
        : mode === MODE_HOCKEY
        ? 'ESPACE ou clic droit maintenu : vous OUVRIR pour avaler le palet ; relâchez, il part vers le pointeur, plus fort si vous l’avez tenu. Fermé, vous le renvoyez — et vous l’arrachez au porteur en le percutant. MAJ : un dash. F maintenu : la GLACE — deux secondes en bloc, qui file tout droit, renvoie le palet et le frappe fort. Le palet dans la cage adverse : un but.'
        : 'ESPACE ou clic droit maintenu : vous OUVRIR. Deux corps ouverts fusionnent ; un corps ouvert boit ce qu’on lui tire ; fermé, il repousse. MAJ : un dash. F maintenu : la GLACE, deux secondes en bloc.'
    const pad = ` MANETTE : le stick gauche pour aller, A ou RT pour pousser, LT ou LB pour s’ouvrir, B ou RB pour dasher${mode === MODE_SUMO ? '' : ', X ou Y pour la glace'} ; Start recommence, Select quitte.`
    el<HTMLElement>('[data-aide]').textContent = commun + propre + pad + (role === 'hote' ? ' Votre machine simule la partie : ne fermez pas cet onglet.' : '')
  }

  function peintScore(jeu: JeuTrame | null): void {
    const boite = el<HTMLElement>('[data-score]')
    boite.hidden = !jeu
    if (!jeu) {
      el<HTMLElement>('[data-decompte]').hidden = true
      return
    }
    for (let j = 0; j < 2; j++) {
      const b = el<HTMLElement>(`[data-but="${j}"]`)
      const texte = String(jeu.scores[j])
      if (b.textContent !== texte) b.textContent = texte
      b.style.color = teinte(j)
    }
    // le chrono, ou le but en or ; et le grand chiffre du décompte
    const restant = Math.ceil(jeu.chrono)
    const chrono = jeu.enOr ? 'BUT EN OR' : `${Math.floor(restant / 60)}:${String(restant % 60).padStart(2, '0')}`
    const sumo = jeu.mode === MODE_SUMO
    const ec = el<HTMLElement>('[data-chrono]')
    if (ec.textContent !== chrono) ec.textContent = chrono
    const grand = el<HTMLElement>('[data-decompte]')
    const chiffre = jeu.phase === PHASE_DECOMPTE ? String(chiffreDecompte(jeu.decompte)) : ''
    grand.hidden = chiffre === ''
    if (grand.textContent !== chiffre) grand.textContent = chiffre
    const quiMarque = jeu.buteur >= 0 ? nom(jeu.buteur) : ''
    const mot =
      jeu.phase === PHASE_FINI
        ? jeu.buteur === moi && role !== 'local'
          ? 'VOUS GAGNEZ'
          : `${quiMarque} GAGNE`
        : jeu.phase === PHASE_BUT
          ? sumo
            ? jeu.buteur < 0
              ? 'TOUS LES DEUX DEHORS — À REJOUER'
              : `MANCHE — ${quiMarque}`
            : `BUT — ${quiMarque}`
          : ''
    // LA FIN DU MATCH : le résultat en grand, et la revanche en un clic. Le
    // panneau se retire de lui-même quand la revanche commence.
    if (jeu.phase === PHASE_FINI && !finAffichee && el<HTMLElement>('[data-voile]').hidden) {
      const titre = role === 'seul' ? 'FIN DU MATCH' : role === 'local' ? `${nom(jeu.buteur)} GAGNE` : jeu.buteur === moi ? 'VICTOIRE' : 'DÉFAITE'
      voile(`${nom(0)}  ${jeu.scores[0]} — ${jeu.scores[1]}  ${nom(1)}`, titre)
    } else if (jeu.phase !== PHASE_FINI && finAffichee) {
      el<HTMLElement>('[data-voile]').hidden = true
      finAffichee = false
    }
    const e = el<HTMLElement>('[data-score-mot]')
    if (e.textContent !== mot) e.textContent = mot
    e.style.color = jeu.phase === PHASE_JEU || jeu.phase === PHASE_DECOMPTE || jeu.buteur < 0 ? '' : teinte(jeu.buteur)
  }

  function peintAth(corps: CorpsTrame[], maintenant: number, dt: number): void {
    for (let j = 0; j < 2; j++) {
      const boite = el<HTMLElement>(`[data-jauge="${j}"]`)
      const c = corps[j]
      const part = c && c.base > 0 ? Math.max(0, Math.min(1, (c.compte + c.prets) / c.base)) : 0
      const couleur = teinte(j)
      ;(boite.querySelector('i') as HTMLElement).style.background = couleur
      const barre = boite.querySelector('u') as HTMLElement
      barre.style.background = couleur
      barre.style.width = `${(part * 100).toFixed(1)}%`
      boite.querySelector('b')!.textContent = c ? `${Math.round(part * 100)} %` : '—'
      const qui = nom(j)
      boite.querySelector('small')!.textContent = c?.disperse ? `${qui} · DISPERSÉ` : c?.ouvert ? `${qui} · OUVERT` : qui
    }

    // le pouls et le débit, une fois par seconde
    const lien = el<HTMLElement>('[data-lien]')
    if (role === 'robot') {
      lien.textContent = 'contre l’ordinateur'
    } else if (role === 'local') {
      const texte = ligneLocale(padsVus())
      if (lien.textContent !== texte) lien.textContent = texte
    } else if (role === 'seul') {
      lien.textContent = 'essai seul — aucune liaison'
    } else if (liaison) {
      poulsReste -= dt
      if (poulsReste <= 0) {
        poulsReste = 1
        poulsId++
        poulsParti = performance.now()
        liaison.envoieOrdre({ t: 'pouls', id: poulsId })
      }
      debitReste -= dt
      if (debitReste <= 0) {
        const duree = 1 - debitReste
        debitReste = 1
        const recus = (liaison.recus - debitRecus) / duree / 1024
        const envoyes = (liaison.envoyes - debitEnvoyes) / duree / 1024
        debitRecus = liaison.recus
        debitEnvoyes = liaison.envoyes
        debitTexte = `envoi ${envoyes.toFixed(0)} ko/s · réception ${recus.toFixed(0)} ko/s`
        if (imagesSautees > 0) debitTexte += ` · ${imagesSautees} image(s) sautée(s) : la ligne ne suit pas`
      }
      const silence = role === 'invite' && miroir ? miroir.age(maintenant) : 0
      lien.textContent =
        silence > 1.5
          ? 'en attente de l’hôte… (sa fenêtre est peut-être en arrière-plan)'
          : `liaison ${latenceMs < 0 ? '…' : latenceMs + ' ms'} · ${debitTexte}`
    }

    // l'étiquette VOUS, au-dessus de son corps, les premières secondes
    const etiquette = el<HTMLElement>('[data-etiquette]')
    const c = corps[moi]
    if (c && !c.disperse && maintenant < etiquetteJusqua) {
      const e = mondeVersEcran(cadre, c.x, c.y - 190)
      etiquette.hidden = false
      etiquette.style.left = `${(e.fx * 100).toFixed(2)}%`
      etiquette.style.top = `${(e.fy * 100).toFixed(2)}%`
      etiquette.style.color = teinte(moi)
      etiquette.style.opacity = etiquetteJusqua - maintenant < 800 ? '0' : '1'
    } else {
      etiquette.hidden = true
    }
  }

  // LE CLAVIER NE TRAVERSE PAS. Le jeu écoute les touches sur la fenêtre
  // (pause, recommencer, raccourcis d'écran) : derrière le multi, il est
  // figé mais il entendrait encore. On arrête donc les touches à la
  // descente, avant qu'elles n'atteignent ses écouteurs. L'action par
  // défaut n'est pas empêchée : coller un code dans un champ marche.
  const bouclier = (ev: KeyboardEvent): void => {
    ev.stopPropagation()
    // ESPACE, en jeu : s'ouvrir tant qu'elle est tenue. (On empêche son
    // action par défaut : elle « cliquerait » le dernier bouton touché.)
    if (page === 'jeu' && ev.code === 'Space') {
      ouvre.clavier = ev.type === 'keydown'
      ev.preventDefault()
    }
    // MAJ, en jeu : le dash
    if (page === 'jeu' && (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight')) dash.clavier = ev.type === 'keydown'
    // F, en jeu : la glace, tant qu'elle est tenue (la touche du gel, dans le jeu)
    if (page === 'jeu' && ev.code === 'KeyF') glace.clavier = ev.type === 'keydown'
  }

  const api: EcranMulti = {
    ouvre(code?: string): void {
      if (!racine) racine = construit()
      if (!ouvert) {
        window.addEventListener('keydown', bouclier, true)
        window.addEventListener('keyup', bouclier, true)
      }
      ouvert = true
      racine.hidden = false
      window.clearInterval(menuId)
      menuId = window.setInterval(() => tourMenu(performance.now()), 40)
      mot('salon', '')
      montre('salon')
      if (code) ouvreJonction(code)
    },
    ferme(): void {
      window.clearInterval(menuId)
      marquePad(null)
      sons.ferme()
      arretePartie()
      fermeLiaison()
      window.removeEventListener('keydown', bouclier, true)
      window.removeEventListener('keyup', bouclier, true)
      ouvert = false
      if (racine) racine.hidden = true
    },
    ouvert: () => ouvert,
  }

  // SONDE DE TEST : ce que l'écran sait de la partie, pour un essai piloté
  // (deux onglets qui se joignent). Lecture seule.
  ;(window as unknown as { __multiSonde?: () => unknown }).__multiSonde = () => ({
    page,
    role,
    moi,
    liaison: liaison?.etat ?? null,
    latenceMs,
    debit: debitTexte,
    imagesSautees,
    corps: role === 'invite' ? (miroir?.corps ?? []) : (hote?.corps() ?? []),
    jeu: role === 'invite' ? (miroir?.jeu(performance.now()) ?? null) : (hote?.jeu() ?? null),
    sons: { ...sons.joues },
    cadre: { ...cadre },
    coeur: { x: monCoeur.x, y: monCoeur.y },
    images: miroir ? { recues: miroir.recues, perdues: miroir.perdues } : null,
    particules: role === 'invite' ? (miroir?.vue(performance.now()).n ?? 0) : (hote?.sim.count ?? 0),
    tSim: role === 'invite' ? (miroir?.tSim ?? 0) : (hote?.tSim ?? 0),
    ouvert: jeMOuvre(),
  })

  return api
}
