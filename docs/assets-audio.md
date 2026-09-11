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
| `goutte-rosee` | 99 % | **refait — 0 %** |
| `condensation` | 76 % | **refait — 0 %** |
| `souffle-vapeur` | 73 % | **refait — 0 %** |
| `eponge` | 21 % | **refait — 0 %** |
| `impact-glace` | 2 % | gardé (1,8 % après chaîne) |
| `gel`, `vortex-sas` | 0 % | **refaits plus graves** |
| `ejection-*` | 0 % | gardés |
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

## 1. `goutte-rosee.wav` — **[CINÉ]** · 2,6 s — **LIVRÉ**

Une goutte qui se forme et se détache. Mesuré à la livraison : **0 % d'énergie
au-dessus de 3 kHz** (l'ancien était à 99 %). Le prompt reste ici pour la trace.

```
A single fat drop of water forming, swelling and detaching from a cold metal
surface, then landing in a shallow pool below, deep round bubble resonance around
600 Hz, thick and liquid, soft muffled plop, no splash spray, no high frequency
tinkle, no glass, no bell, dark warm timbre, all energy below 3 kHz, recorded
close in a small padded metal room, single event, silence after 2 seconds
```
Négatif : `tinkle, bell, glass, chime, sparkle, splash, spray, hiss, reverb tail, music`

## 2. `condensation.wav` — **[CINÉ]** · 2 s — **LIVRÉ**

La vapeur qui perle sur une paroi froide. Mesuré : **0 %** au-dessus de 3 kHz
(l'ancien : 76 %).

```
Fine moisture condensing on a cold metal wall, a soft dense micro-crackle of
thousands of tiny droplets forming at once, muffled and organic like rain soaking
into cloth, low and close, no sizzle, no frying, no static, no high frequency
shimmer, dark warm timbre, all energy below 3 kHz, gentle fade into silence,
2 seconds total
```
Négatif : `sizzling, frying, static, white noise, hiss, sparkle, crackling fire, music`

## 3. `souffle-vapeur.wav` — **[CINÉ]** · 4,2 s — **LIVRÉ**

Le souffle de la planche « Pas le temps de philosopher », dans l'alerte.
Une **expiration**, pas une soupape. Mesuré : **0 %** au-dessus de 3 kHz
(l'ancien : 73 %).

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

## 5. `vortex-sas.wav` — **[CINÉ]** · 7 s — **LIVRÉ**

L'aspiration du sas — planche « Une seule ouverture. Elle aspire. »
Mesuré : **93 % de l'énergie sous 200 Hz**, rien au-dessus de 3 kHz.

```
Deep slow suction of air being drawn through a circular airlock iris, a wide
rotating swirl that builds and pulls inward, subsonic body with a slow spiralling
motion, feels like being drawn in rather than blown at, no whistle, no wind gust,
no jet, dark warm timbre, all energy below 3 kHz, continuous build over 6 seconds
then abrupt clean stop
```
Négatif : `whistle, wind gust, jet, storm, hiss, screech, music`

## 6. `gel.wav` · 2,5 s — **LIVRÉ**

L'eau qui se resserre en glace (transformation du joueur).
Mesuré : **89 % sous 200 Hz**. Les douze éclats cristallins de synthèse qui
doublaient ce son ont été retirés en même temps.

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

## 8. `eponge.wav` · 2,5 s — **LIVRÉ**

L'éponge qui boit le fluide. Mesuré : **73 % sous 200 Hz**, 0 % d'aigus.
Attention : le jeu ne le joue PAS pour l'instant — la succion avait été coupée
parce qu'elle agaçait plus qu'elle n'informait. Le fichier est dans la palette
(table de montage) ; une ligne suffit à le remettre en jeu si vous le voulez.

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

# Les candidates, et l'écoute

Le 10/09/2026, cinq lits ont été regénérés sous Suno et livrés **à côté** des
lits qui jouent, sous `masters/sound/<nom>-v2.mp3` : `accueil-v2` (M1),
`cuve-tiede-v2` (M2), `cuve-glaciale-v2` (Desolate Laboratory),
`zone-hublot-v2` (Frozen Hiss), `zone-conduite-v2` (Warm Pressure) ; puis
trois le soir même : `zone-chambre-v2` (Warm Dark Rest), `temps-suspendu-v2`
(Tension Held) et `hub` (Quiet Resting Atmosphere, pour un lit du hub qui
n'existe pas encore dans la bande-son). Rien ne remplace rien tant que
l'oreille n'a pas tranché.

Mesuré sur les cinq masters (mêmes sondes que les lits livrés) : 0 % d'énergie
au-dessus de 3 kHz, enveloppe entre ±2,1 et ±3,9 dB. Le point de coupe de
chaque boucle (dans `tools/audio/prepare.py`) est la fenêtre de 40 s la plus
plate du master — écart-type de l'enveloppe seconde par seconde minimal, hors
quinze premières et dernières secondes.

**L'écoute** : sur l'accueil, en mode concepteur, une ligne ÉCOUTE sous la
rangée d'outils joue les musiques du projet — les six lits et les candidates —
dans un ordre tiré au sort à l'ouverture, **telles que le jeu les joue** (la
boucle taillée, le même bus, le même volume), à la place du lit d'accueil.
Précédent, lecture, arrêt, suivant ; le titre dit le rang et si la piste joue
dans le jeu ou n'est qu'une candidate. Lancer le jeu arrête l'écoute. Une
nouvelle candidate s'ajoute en deux lignes : son master dans `BOUCLES`
(`prepare.py`, puis `python3 tools/audio/prepare.py <nom>`), et sa ligne dans
`PISTES_ECOUTE` (`src/game/jukebox.ts`).

**L'avis** : au bout de la ligne ÉCOUTE, trois touches — `−1`, `○` (neutre),
`+1` — posent **mon** avis sur la piste en cours ; le titre donne le total et
qui pense quoi (« +1 · JULIEN +1, MARIE +1, PAUL −1 », entier dans
l'infobulle). Un avis par personne et par piste — la personne est le nom de la
borne, celui des records ; sans nom, « anonyme », et tous les anonymes ne font
qu'un. Le neutre retire le sien et rien d'autre. Le document est **partagé** :
il vit au magasin des réglages (`/api/reglages`, domaine `ecoute`), chargé à
l'ouverture de l'accueil en mode concepteur et publié 800 ms après la dernière
touche (une écriture pour une rafale). À l'arrêt, le titre donne le bilan
(« 3 retenues, 2 écartées, 1 partagée » — retenue si la somme est positive,
écartée si négative, partagée si les avis se neutralisent). La forme et ses
bornes : `src/game/ecouteAvis.ts`.

Quand une candidate l'emporte, on la promeut : son entrée de `BOUCLES` prend
le nom de sortie du lit qu'elle remplace, et l'ancien master reste sous un
suffixe `-v1` (comme `vaporisation-v1-jet.mp3`).

# La bande son — les prompts, lot par lot

Les prompts M1 à M10 (les candidates ci-dessus) ont été donnés dans la
conversation et **ne sont pas dans le dépôt** : à partir d'ici, chaque lot
s'écrit **ici d'abord**, pour qu'un prompt se retrouve et se regénère. La
numérotation reprend à M11.

Ce que tous les lits partagent, et qui n'est pas répété dans chaque prompt :
**Suno, morceau instrumental** (cocher *Instrumental*), 3 à 4 minutes,
**intensité stable** d'un bout à l'autre — la chaîne garde la fenêtre de 40 s
la plus plate, un morceau qui « monte » perd sa montée. Une ponctuation, au
contraire, doit **s'ouvrir sur un événement franc** : la chaîne coupe autour
de l'attaque. La phrase de recalage de la page (« dark warm timbre, all energy
below 3 kHz… ») se colle en fin de prompt si le résultat sort trop clair.

Le fil rouge, celui des lits qui jouent : un module spatial de 1970, des nappes
analogiques chaudes, une bande magnétique, rien de brillant, rien de rythmé au
sens d'une batterie — le pouls, quand il y en a un, est celui d'une machine ou
d'un corps.

## Lot 1 — le fil d'une expédition (11/09/2026)

Où ces cinq lits se branchent : un tableau les impose par `ambiance`
(éditeur), une séquence par `piste` ou `ponctuation`
(`src/game/sequence.ts`), une planche de cinématique par la table de montage.
Rien n'est câblé tant que l'oreille n'a pas tranché — ils entrent d'abord
dans l'ÉCOUTE, comme les candidates.

### M11. `eveil.mp3` — l'éveil dans la cuve · boucle 40 s

Les planches « Qui êtes-vous ? Où êtes-vous ? » de l'ouverture, et la
naissance dans la cuve avant l'alerte. Une conscience qui se forme : de la
curiosité, aucune peur, et **rien ne se résout** — pas encore de mélodie.
Titre de travail : *First Light in the Tank*.

```
Slow ambient instrumental, the first minutes of a consciousness waking inside
a glass tank in a 1970s orbital laboratory. A deep warm analog pad breathing
very slowly, one soft submerged piano note every few bars like a thought
forming, faint liquid movement underneath, tape warmth, muted and close,
curiosity without fear, nothing resolves, no melody yet, no drums, no
percussion, no vocals, no bright synth, no hi-hats, no cymbals, dark warm
timbre, everything in the low and mid range, static mood that could loop
forever, 60 bpm feel
```
Négatif : `vocals, drums, percussion, hi-hats, cymbals, bright synth lead, arpeggio, piano melody, strings crescendo, choir, reverb shimmer`

### M12. `alerte.mp3` — l'alerte et la brèche · boucle 40 s

Les planches « Pas le temps de philosopher » et « Le confinement cède », puis
le lit du **premier tableau**, celui où les commandes s'apprennent. Même
famille que `sting-derniere-impulsion` (le drone qui monte d'un demi-ton, le
cœur de basse) : la ponctuation doit pouvoir tomber dessus sans jurer.
L'urgence est **tenue**, jamais hurlée — pas de sirène, le jeu en a déjà.
Titre de travail : *Red Lights, Empty Module*.

```
Tense dark ambient instrumental, an orbital laboratory module evacuating under
red emergency lights, 1970s space program. A slow heavy sub bass pulse like a
heartbeat at 70 bpm, a low sustained drone that slowly rises and falls by a
semitone, distant muffled machinery thuds, a cold analog pad holding one
dissonant interval, dread and urgency kept under control, no siren, no alarm
beeps, no drums, no percussion hits, no vocals, no bright synth, no screech,
dark warm timbre, all energy low, steady intensity throughout so it can loop
```
Négatif : `siren, alarm, beeps, drums, percussion, orchestral stab, brass, vocals, choir, bright synth, screech, glitch, riser`

### M13. `depart.mp3` — le sas et la carte de la station · boucle 40 s

Le sas de lancement (planches `depart-1..3`), l'écran LA STATION où l'on
choisit la coursive, et l'entre-deux modules. Le seul lit **un peu porteur**
de la bande son : on va quelque part. Espoir retenu, incertitude, le
contrôle de mission de 1970 plutôt que l'épopée.
Titre de travail : *Airlock, Station Chart*.

```
Calm contemplative ambient instrumental, standing at an airlock studying a
chart of a space station before setting out, 1970s mission control optimism
held quietly. A warm analog pad in slow motion, a soft muted electric piano
playing a sparse two-chord figure every eight bars, a gentle low pulse
suggesting forward motion, the distant hum of the station, hopeful but
uncertain, spacious, tape warmth, no drums, no percussion, no vocals, no
bright synth, no cymbals, dark warm timbre, mostly low and mid frequencies,
steady and loopable, 66 bpm
```
Négatif : `drums, percussion, vocals, choir, bright synth lead, arpeggiator, cymbals, hi-hats, epic build, orchestra, fanfare`

### M14. `pompe.mp3` — la Pompe de reprise (boss) · boucle 40 s

La salle qui se défend (`docs/boss-pompe.md`) : une machine patiente qui
aspire par cycles. Le lit tourne pendant tout le combat, phases comprises ;
le climax — la cuve de rétention qui crève — sera une **ponctuation à part**
(lot 2), pour que la boucle reste plate. Menace mécanique, pas de batterie :
le pouls est celui d'une turbine.
Titre de travail : *Protocol 21-R*.

```
Dark mechanical ambient instrumental, a huge industrial pump awakening to
reclaim an escaped fluid inside a 1970s space station, a room that defends
itself. A relentless low rotating pulse at 84 bpm like a slow turbine, deep
sub bass throbbing in cycles of suction, a cold analog pad in a minor mode
holding tension, distant metallic groans and pressure surges felt more than
heard, menacing, patient, machine-like, no drum kit, no cymbals, no hi-hats,
no vocals, no bright synth lead, no orchestral hits, dark warm timbre, all
energy low and mid, constant intensity that loops without a climax
```
Négatif : `drum kit, cymbals, hi-hats, snare, vocals, choir, orchestral hits, brass, bright synth, dubstep, distortion guitar, riser, drop`

### M15. `corps-defait.mp3` — la dispersion · ponctuation 10 à 12 s

Le corps qui passe sous le volume critique et le sursis qui suit : la
défaite, sans le mot. Comme `fin-de-course`, un extrait coupé dans un morceau
long — d'où l'ouverture sur **une note grave franche**, puis tout se défait.
Acceptation, pas tragédie ; surtout pas de jingle de game over.
Titre de travail : *Below Critical Volume*.

```
Slow ambient instrumental, a body of water scattering into droplets too small
to hold together, a consciousness thinning out in zero gravity, 1970s space
program melancholy. Opens on one deep soft low piano note with a warm analog
pad underneath, then everything slowly disperses, notes drifting apart,
detuning slightly, thinning to almost nothing, quiet acceptance rather than
tragedy, sparse, no drums, no percussion, no vocals, no bright synth, no
strings swell, dark warm timbre, low and mid frequencies only, long natural
fades
```
Négatif : `drums, percussion, vocals, choir, game over jingle, strings swell, bright synth, bells, reverb shimmer, sad piano melody`

## Les lots à venir

- **Lot 2 — les écrans et les fins** : les mémoires et le CYCLE (tisser une
  transformation), le marchand et l'économat, la cuve crevée (ponctuation du
  boss), et les deux finales qui manquent depuis le début, `finale-pure` et
  `finale-souillee`.
- **Lot 3 — les lieux** : l'observatoire (module boss, froid, les étoiles
  sous le plancher), une zone plasma (les rails à champ — la bande son n'a
  que glace, vapeur et eau), la révélation du miroir (secteur 4), le
  palmarès et les fantômes, le codex.

# Le parti pris : un thème, quatre états, une révélation

Ce qui rend une bande son mémorable n'est presque jamais la qualité d'un
lit : c'est **un thème qu'on peut fredonner en sortant**, entendu sous
plusieurs visages jusqu'à ce qu'il soit reconnu. Des nappes sombres et
chaudes, si belles soient-elles, s'oublient toutes de la même façon. Les
lits d'aujourd'hui et le lot 1 sont bons pour le confort ; ils ne laissent
rien dans la tête. Le parti pris ci-dessous ne les jette pas : il leur donne
une colonne vertébrale.

## 1. Un seul thème, court, qui pose une question

Le thème de Sujet 21 est **une question, jamais résolue** — celle des cartes
de l'éveil, « Qui êtes-vous ? ». Musicalement : six notes lentes, une montée
qui s'ouvre puis redescend par degrés **sans retomber sur la tonique**.

**Pas un choral.** Le premier essai (un orgue analogique façon *Solaris*)
sonnait église : sacré, vertical, trop grand pour une cuve. Le thème est une
**berceuse de laboratoire** — ce qu'un Créateur fredonnerait distraitement à
la substance dans sa cuve, sans savoir qu'elle écoute. Les berceuses sont les
mélodies qu'on retient le mieux, et l'idée colle au récit : la conscience
est un accident, la berceuse aussi. Deux matières à essayer, toutes deux
de 1970, toutes deux sous 3 kHz par nature, aucune ne renvoie à un lieu de
culte :

- **T0a, le piano électrique.** Un Rhodes au grave, à travers une bande qui
  ondule, et un lead analogique doux et légèrement désaccordé qui double la
  mélodie (le CS-80 de Vangelis, la mélancolie de Boards of Canada). Chaud,
  nostalgique, domestique — le son d'un magnétophone oublié dans un module.
- **T0b, la corde sèche.** La mélodie sur une **basse électrique étouffée**
  (la paume sur les cordes, l'attaque mate) ou une guitare nylon proche du
  micro, presque sans réverbération, sur un pad tenu. Sec, intime, un peu
  inquiétant — la lenteur d'un thème de Badalamenti. C'est l'opposé exact de
  l'église : rien ne résonne, tout est à portée de main.

Le thème se génère **une fois**, en master (`theme.mp3`), et **tout le reste
en dérive** : sous Suno, la fonction *Cover* réinterprète un morceau existant
dans un autre style **en gardant sa mélodie**. Chaque lit devient donc
« *Cover* du thème + une ligne de style », au lieu d'un prompt indépendant
qui n'a aucune chance de citer la même mélodie. C'est le geste qui fait
tenir l'ensemble, et il change l'ordre des choses : **le thème d'abord**,
puis le lot 1 (M11 à M15) regénéré comme covers, puis la suite.

### T0a. `theme.mp3` — la berceuse, piano électrique · master, 3 min

```
Slow instrumental lullaby for a 1970s space laboratory, a simple six note
melody that rises and opens then steps back down without ever resolving,
like a question hummed absent-mindedly to something asleep in a tank. Played
on a warm Fender Rhodes electric piano in its low register through wobbling
tape, the melody doubled by a soft slightly detuned analog synth lead, a slow
round bass note underneath, tape hiss removed, very slow, sparse, intimate
and nostalgic, no drums, no percussion, no vocals, no organ, no strings, no
bright high register, dark warm timbre
```
Négatif : `organ, church, choir, vocals, drums, percussion, strings, brass, arpeggiator, high register, reverb hall, epic, hymn`

### T0b. `theme.mp3` — la berceuse, corde sèche · master, 3 min

```
Slow instrumental lullaby for a 1970s space laboratory, a simple six note
melody that rises and opens then steps back down without ever resolving,
like a question hummed absent-mindedly to something asleep in a tank. The
melody played on a palm-muted electric bass, close to the microphone, dry
and dull with almost no reverb, each note left to die on its own, over a
quiet sustained analog pad, very slow, sparse, intimate and slightly uneasy,
no drums, no percussion, no vocals, no organ, no strings, no bright high
register, dark warm timbre
```
Négatif : `organ, church, choir, vocals, drums, percussion, strings, brass, arpeggiator, high register, reverb hall, epic, hymn, slap bass`

On en génère plusieurs de chaque, on garde **celui qu'on fredonne le
lendemain** — c'est le seul test qui vaille, et il ne se mesure pas. L'avis
de l'ÉCOUTE est là pour ça.

## 2. Le thème a quatre états, comme le corps

Le cœur du jeu est le cycle des états ; la musique le suit. Le même thème,
quatre matières — c'est ce qui fait qu'un joueur **entend** dans quel état il
est, et qu'une transformation s'entend comme une transformation du thème.
Quatre covers du master T0, aucune sur un instrument d'église :

| État | `cover` du thème, ligne de style | où |
| --- | --- | --- |
| **EAU** | `the same lullaby on a muted electric piano heard through water, notes slightly bending and wobbling, a slow round bass, warm and submerged, no drums, no vocals, no organ` | `zone-chambre`, lit des tableaux d'eau |
| **GLACE** | `the same lullaby frozen: every note held twice as long on a felt piano recorded very close, tape slowed down and slightly detuned, a sub bass, almost motionless, cold and dry, no reverb, no drums, no vocals, no organ` | `zone-hublot`, `cuve-glaciale` |
| **VAPEUR** | `the same lullaby dissolved into breath: only the contour remains, played by a soft blurred analog flute-like synth inside a warm pad, blurry and weightless, no drums, no vocals, no organ` | `zone-conduite`, `cuve-tiede` |
| **PLASMA** | `the same lullaby electrified: a low analog sawtooth synth with a slow electric pulse, charged and humming like a field coil, still dark, no hi-hats, no drums, no vocals, no organ` | une zone plasma, qui n'existe pas encore dans la bande son |

La glace joue le thème **deux fois plus lent**, le plasma **avec un pouls** :
la vitesse et le pouls disent l'état avant le timbre.

## 3. Le thème se révèle comme le récit : un fragment par expédition

Le scénario livre **un fragment par expédition bouclée**, dix fragments
jusqu'à la révélation du miroir (`docs/scenario.md`). La musique peut faire
**exactement la même chose** : dans les runs, on n'entend jamais le thème en
entier — les lits n'en citent que les **trois premières notes**, enfouies. Le
lit du hub, lui, **gagne une note par expédition bouclée** ; à la dixième, la
cinématique MIROIR joue le choral complet, pour la première fois, et le
joueur reconnaît ce qu'il entendait par bribes depuis le début. C'est le
genre de chose dont on parle après.

Techniquement : le hub en **pistes superposées** (Suno exporte les stems ; ou
un cover « pad seul » et un cover « thème seul » que la bande-son mélange), et
un niveau du thème indexé sur le compteur d'expéditions bouclées — la
bande-son mélange déjà deux lits selon la température (`soundtrack.ts`, le
`chill`), c'est le même mécanisme avec une autre variable.

## 4. La règle physique du jeu s'entend : rétrécir, c'est perdre des voix

« Se déplacer, c'est rétrécir. » Le lit d'un tableau **perd des voix avec la
masse** : à pleine masse, le pad, la basse et le thème ; sous la moitié, le
thème s'éteint ; près du volume critique, il ne reste que la basse et le
souffle. Le joueur l'entend sans qu'on le lui dise, et la dispersion (M15)
tombe sur un silence déjà presque fait. Même mécanisme que ci-dessus, avec la
masse comme variable ; cela demande les lits en deux ou trois pistes plutôt
qu'une.

Et les **ouvertures sur le dehors** (vides, vitrées, les étoiles sous le
plancher) : le son ne se propage pas dans le vide. Près d'une ouverture, tout
s'efface sauf le sub — un silence qui a un sens dans la fiction est plus
mémorable qu'une musique.

## 5. Une seule voix, une seule fois

Aucune voix dans tout le jeu — c'est la règle de toutes les pages ci-dessus.
**Sauf une fois** : la finale pure. La berceuse, fredonnée sans paroles, par une
seule voix humaine, basse, proche, sans effet — la voix d'un Créateur, ou
celle du sujet qui devient miroir, on ne le dit pas. L'exception n'est
mémorable que parce que la règle a tenu trois heures. La finale souillée est
son envers : le thème **retourné** (les intervalles inversés) et joué par la
Pompe, la machine, sans aucune chaleur.

### F1. `finale-pure.mp3` — cover de T0

```
the same lullaby hummed by a single low human voice, wordless, very close to
the microphone, unaccompanied at first then joined by the warm electric
piano, intimate, fragile, slow, no reverb, no choir, no drums, no lyrics
```
Négatif : `choir, lyrics, drums, percussion, strings, reverb, epic, autotune`

### F2. `finale-souillee.mp3` — cover de T0

```
the same lullaby inverted and played by a cold industrial machine, low
rotating pulse, metallic synth tones slightly out of tune, no warmth, no
humanity, relentless and slow, no drums kit, no vocals, no bright synth
```
Négatif : `vocals, drum kit, warmth, strings, choir, bright synth, orchestra`

## Ce que cela change à l'ordre des lots

1. **T0 d'abord**, plusieurs prises, une retenue à l'oreille.
2. **Les quatre états** en cover de T0, mesurés, dans l'ÉCOUTE en face des
   lits actuels.
3. **Le lot 1** (M11 à M15) regénéré en cover de T0 avec les mêmes lignes de
   style — l'éveil cite les trois premières notes, le boss le thème
   retourné, la dispersion le thème qui se défait.
4. Puis les écrans, les lieux, et les deux finales.

Ce que Suno ne garantit pas : une mélodie **exactement** identique d'un cover
à l'autre — on écoute, on rejette ce qui ne cite pas le thème, et on mesure
le reste comme d'habitude. Le mélange par masse et par expéditions bouclées
est du code (`soundtrack.ts`), à faire une fois les pistes retenues.
