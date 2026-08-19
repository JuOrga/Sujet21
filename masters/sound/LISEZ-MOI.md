# Masters sonores

Les fichiers de ce dossier sont les **originaux** générés sous Suno : morceaux
complets, stéréo, 3 à 5 minutes. Ils ne partent pas en ligne — `masters/` est
hors de `public/`, donc rien ici n'est déployé ni téléchargé par le joueur.

Ce que le jeu utilise se trouve dans `public/sound/`, fabriqué à partir d'ici :

```
python3 tools/audio/prepare.py
```

Le script taille les boucles (30 à 40 s), coupe les ponctuations autour d'une
attaque franche (6 à 11 s), normalise et ré-encode en mono léger. Les 26 Mo de
masters deviennent 1,8 Mo embarqués.

## Ajouter ou remplacer un son

1. Déposer le master ici (MP3 ou WAV).
2. L'ajouter à la liste correspondante dans `tools/audio/prepare.py` —
   `BOUCLES` (lit ou ambiance), `PONCTUATIONS` (extrait court d'un morceau
   long) ou `COURTS` (bruitage déjà à la bonne durée).
3. Relancer le script, écouter `public/sound/`, ajuster le point de coupe si
   l'entrée n'est pas franche.

Pour retrouver un point de coupe : `tools/audio/` contient de quoi profiler une
piste (enveloppe seconde par seconde) — sinon, les valeurs actuelles ont été
choisies sur des attaques mesurées à 17–25 dB au-dessus du creux qui précède.

## La nappe de vapeur

`vapeur-nappe.wav` est à part : c'est la seule boucle pilotée **à la frame**
par le jeu (`setGasLevel`, dans `src/game/audio.ts`), pas par la bande-son.
Elle a remplacé une voix de bruit blanc filtré qui sifflait quoi qu'on lui
fasse. Son niveau dans le jeu tient à une seule ligne — `v * 0.6` — et la
lecture reboucle à 0,12 s des bords, pour que la couture tombe en pleine
matière plutôt que sur les fondus.

`vaporisation.wav` (la floraison chaude) a remplacé le jet sous pression :
l'ancien master est gardé sous `vaporisation-v1-jet.mp3`, plus référencé.

## Ce qui manque encore

Les deux finales (`finale-pure`, `finale-souillee`) ne sont pas générées.
