# Projet 21 — effets sonores à générer

Prompts complets, prêts à copier-coller (en anglais : les générateurs y répondent
mieux). Déposez les fichiers dans `masters/sound/` sous le nom indiqué — la chaîne
`python3 tools/audio/prepare.py` normalise, allège et publie dans `public/sound/`.

## Générateur

- **ElevenLabs Sound Effects** : le plus direct pour les bruitages courts, jusqu'à
  22 s. Collez le prompt tel quel, le champ « negative » n'existe pas — les
  interdits sont déjà dans le texte.
- **Stable Audio** : accepte un *negative prompt*, collez-y la ligne « Négatif ».
- **Suno** : réservé aux ponctuations musicales (les quatre *stings*) et aux lits.
  Demandez un morceau, je découpe l'extrait au bon endroit.

## Format de livraison — le même pour tous

**WAV · 48 kHz · 16 bits · mono suffit** (le jeu somme en mono de toute façon).
Pas de fondu à ajouter, pas de normalisation à faire : `prepare.py` s'en charge.
Le fichier doit finir en **silence franc**, sans queue de réverbération qui traîne.

## La règle qui a tout changé

Les sons qui « faisaient mal » avaient tous le même défaut, mesurable : leur
énergie était **au-dessus de 3 kHz**. Mesure sur les masters d'origine —

| Son | énergie > 3 kHz | verdict |
| --- | --- | --- |
| `goutte-rosee` | 99 % | à refaire |
| `condensation` | 76 % | à refaire |
| `souffle-vapeur` | 73 % | à refaire |
| `eponge` | 21 % | à revoir |
| `impact-glace` | 2 % | bon |
| `gel`, `vortex-sas`, `ejection-*` | 0 % | bons |
| `vapeur-nappe`, `vaporisation` (livrés) | 0 % | la référence |

**Le jeu se passe dans un module spatial de 1970, pas dans un studio.** Tout doit
tenir sous 3 kHz, être chaud, mat, et sonner comme une matière — de l'eau, de la
glace, une membrane — jamais comme un synthétiseur ni comme un sifflement.

Cette phrase peut être ajoutée à la fin de n'importe quel prompt ci-dessous pour
recaler un résultat trop clair :

```
dark warm timbre, all energy below 3 kHz, no high frequency content, no hiss,
no sizzle, no bright transient, recorded in a small padded metal room
```

---

# Les bruitages

Onze sons courts, joués tels quels par le jeu ET disponibles dans la table de
montage des cinématiques. Ceux marqués **[CINÉ]** sont utilisés par l'ouverture.

## 1. `goutte-rosee.wav` — **[CINÉ]** · 2 s

Une goutte qui se forme et se détache. Le plus urgent : l'actuel est à 99 %
d'aigus, c'est un tintement de verre là où il faut de l'eau.

```
A single fat drop of water forming, swelling and detaching from a cold metal
surface, then landing in a shallow pool below, deep round bubble resonance around
600 Hz, thick and liquid, soft muffled plop, no splash spray, no high frequency
tinkle, no glass, no bell, dark warm timbre, all energy below 3 kHz, recorded
close in a small padded metal room, single event, silence after 2 seconds
```
Négatif : `tinkle, bell, glass, chime, sparkle, splash, spray, hiss, reverb tail, music`

## 2. `condensation.wav` — **[CINÉ]** · 2 s

La vapeur qui perle sur une paroi froide.

```
Fine moisture condensing on a cold metal wall, a soft dense micro-crackle of
thousands of tiny droplets forming at once, muffled and organic like rain soaking
into cloth, low and close, no sizzle, no frying, no static, no high frequency
shimmer, dark warm timbre, all energy below 3 kHz, gentle fade into silence,
2 seconds total
```
Négatif : `sizzling, frying, static, white noise, hiss, sparkle, crackling fire, music`

## 3. `souffle-vapeur.wav` — **[CINÉ]** · 3 s

Le souffle de la planche « Pas le temps de philosopher », dans l'alerte.
Une **expiration**, pas une soupape.

```
A long warm exhale of steam escaping slowly from a wide vent in a space station
corridor, soft breathy body, felt-like and woolly, rising then settling, sounds
like a huge slow breath rather than a pressure release, no whistle, no kettle,
no valve, no jet, no hiss, dark warm timbre, all energy below 3 kHz, natural
decay into silence over 3 seconds
```
Négatif : `whistle, kettle, valve, jet, spray, aerosol, hiss, high pressure, music`

## 4. `impact-glace.wav` — **[CINÉ]** · 2 s

Le bloc de glace qui heurte la paroi — planche « Le confinement cède ».
L'actuel est déjà bon : à ne refaire que si vous voulez plus lourd.

```
A heavy block of ice striking a thick metal bulkhead once, dull deep thud with a
short dense crystalline body inside it, weight and mass first, brightness never,
no glass shattering, no debris scatter, no high frequency crack, dark warm timbre,
all energy below 3 kHz, tight decay, silence after 2 seconds
```
Négatif : `glass shatter, debris, sharp crack, bright transient, reverb tail, music`

## 5. `vortex-sas.wav` — **[CINÉ]** · 6,5 s

L'aspiration du sas — planche « Une seule ouverture. Elle aspire. »
L'actuel est bon ; ce prompt sert à en faire une variante plus longue.

```
Deep slow suction of air being drawn through a circular airlock iris, a wide
rotating swirl that builds and pulls inward, subsonic body with a slow spiralling
motion, feels like being drawn in rather than blown at, no whistle, no wind gust,
no jet, dark warm timbre, all energy below 3 kHz, continuous build over 6 seconds
then abrupt clean stop
```
Négatif : `whistle, wind gust, jet, storm, hiss, screech, music`

## 6. `gel.wav` · 2 s

L'eau qui se resserre en glace (transformation du joueur).

```
Water tightening and locking into solid ice, a slow low creaking crystallization
spreading outward, dense and structural, groaning wood-like stress under the
surface, no bright crackle, no glass, no ice cubes in a drink, dark warm timbre,
all energy below 3 kHz, settles into silence after 2 seconds
```
Négatif : `ice cubes, drink, glass, bright crackle, sparkle, music`

## 7. `vaporisation.wav` · 4 s — **LIVRÉ**

Déjà généré et intégré (`warm steam bloom`). Gardé ici comme référence de ce qui
marche : 0 % d'énergie au-dessus de 3 kHz, 62 % sous 200 Hz.

## 8. `eponge.wav` · 2 s

L'éponge qui boit le fluide.

```
Wet porous foam absorbing water, a thick slow squelch as liquid soaks into
cavities, dense and muffled, low gurgle underneath, organic and close, no
squeaking, no rubber, no high frequency wetness, dark warm timbre, all energy
below 3 kHz, settles into silence after 2 seconds
```
Négatif : `squeak, rubber, balloon, sizzle, hiss, music`

## 9-11. `ejection-1.wav`, `ejection-2.wav`, `ejection-3.wav` · 0,8 s chacun

Les gouttes éjectées : trois prises tirées au sort à chaque impulsion, pour que
la répétition ne s'entende pas. **Générez-les avec la même formule en changeant
la hauteur** — c'est ce qui les rend sœurs plutôt que triplées.

```
A single drop of water falling into a deep pool, one clean round plop with a
resonant bubble tone at 560 Hz, thick and liquid, very short, no splash spray,
no high frequency, dark warm timbre, all energy below 3 kHz, complete silence
after 0.8 seconds
```
Pour la 2 : remplacer `560 Hz` par `600 Hz`. Pour la 3 : par `670 Hz`.
Négatif : `splash, spray, tinkle, bell, reverb tail, music`

---

# Les ponctuations

Quatre respirations musicales, plus longues, posées sur un moment fort. Elles
peuvent venir de **Suno** (morceau complet, je découpe l'attaque) ou d'un
générateur d'effets (extrait déjà taillé, dites-le moi pour que je mette le point
de coupe à zéro dans `prepare.py`).

## 12. `sting-collecte.wav` — **[CINÉ]** · 6 s

La dernière planche : « Rien ne se perd. Tout ce qui passe compte. »

```
A short warm orchestral-electronic sting of quiet confirmation, one low sustained
note blooming into a soft major resolution, muted strings and a deep analog pad,
1970s space program optimism held back rather than triumphant, no drums, no
percussion, no bright cymbals, no fanfare, dark warm timbre, clean fade to silence
over 6 seconds
```
Négatif : `drums, percussion, cymbals, fanfare, brass stab, choir, vocals, bright synth lead`

## 13. `sting-derniere-impulsion.wav` — **[CINÉ]** · 6 s

L'alerte : « Pas le temps de philosopher. »

```
A tense low sting of imminent danger, a deep sustained drone rising a semitone
under a slow pulsing heartbeat of bass, dread without violence, restrained and
cold, no drums, no impact hit, no orchestral stab, no alarm siren, dark warm
timbre, all energy below 3 kHz, sustains then cuts clean after 6 seconds
```
Négatif : `siren, alarm beep, orchestral stab, drums, screech, vocals, bright synth`

## 14. `sting-record.wav` · 8 s

Le record battu, à l'écran des palmarès.

```
A short bright-hearted sting of achievement, a warm ascending three note motif on
a soft analog synth over a low sustained pad, proud but quiet, 1970s mission
control rather than arcade victory, no drums, no percussion, no fanfare, no
sparkle, warm timbre, clean fade to silence over 8 seconds
```
Négatif : `arcade jingle, chiptune, drums, fanfare, sparkle, vocals, bells`

## 15. `fin-de-course.wav` · 11 s

La fin de l'expédition — le moment où tout retombe.

```
A long calm closing piece, a deep sustained pad slowly resolving downward, one
distant low bell tone near the end, resignation and quiet rather than defeat,
sparse and spacious, 1970s space program melancholy, no drums, no percussion, no
vocals, warm dark timbre, natural fade to silence over 11 seconds
```
Négatif : `drums, percussion, vocals, choir, bright strings, fanfare, game over jingle`

---

# Après la livraison

1. Déposer les WAV dans `masters/sound/`.
2. `python3 tools/audio/prepare.py` — la liste `COURTS` connaît déjà les noms ;
   un nouveau nom se déclare là (voir `masters/sound/LISEZ-MOI.md`).
3. Écouter `public/sound/`, ajuster.

Les six lits musicaux (`accueil`, `cuve-tiede`, `cuve-glaciale`, `zone-hublot`,
`zone-conduite`, `zone-chambre`) ne sont pas dans ce document : ils viennent de
Suno et tiennent la route. Leurs prompts peuvent être ajoutés ici si l'un d'eux
doit être refait.
