// L'ENTRÉE DE LA PAGE — un sas avant le jeu.
//
// main.ts démarre tout à l'évaluation (rendu, simulation, appels à /api) :
// on ne peut pas le retenir de l'intérieur, ses imports s'évaluent avant
// la première ligne. Il est donc chargé d'ici, à la demande, une fois la
// page réellement affichée (voir activation.ts : le pré-rendu de la barre
// d'adresse de Chrome le faisait tourner en cachette).
//
// Les polices restent ICI, pas dans main.ts : importées par l'entrée, leur
// feuille de style est liée dans index.html et part dès le premier octet,
// au lieu d'attendre le chargement du jeu.
//
// Un échec de chargement n'est pas rattrapé exprès : la promesse rejetée
// remonte en « unhandledrejection », que la garde d'amorçage d'index.html
// transforme en panneau lisible.
import '@fontsource/michroma'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import { apresActivation } from './activation'

void apresActivation(document).then(() => import('./main'))
