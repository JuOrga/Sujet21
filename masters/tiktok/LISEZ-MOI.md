# Clips TikTok — Sujet 21 · Tension de surface

Trois vidéos verticales 1080×1920, 30 im/s, H.264 + AAC, prêtes à publier.
Chaque vidéo existe en deux versions, son normalisé à −14 LUFS (crête −1,5 dB) :

- `*.mp4` — avec sa musique (composée par code, libre de droits) et les
  bruitages du jeu ;
- `*-musique-du-jeu.mp4` — sur un morceau de la **bande-son du jeu**, coupes
  recalées sur son tempo (voir plus bas) ;
- `*-sans-musique.mp4` — bruitages du jeu seuls, pour poser un **son
  tendance** directement dans TikTok (c'est ce qui pousse le plus la
  portée : l'algorithme favorise les sons en vogue).

Les images sont **le vrai jeu**, filmé image par image dans un navigateur
sans écran (temps virtuel : 30 images parfaites par seconde, aucune saccade).
La fabrication est décrite dans `tools/tiktok/LISEZ-MOI.md`. Les gestes sont scriptés (pilote automatique qui dose les éjections) ; le
temps est accéléré ×2 par le time warp du jeu sur les traversées.

## Les trois vidéos

| Fichier | Durée | Angle |
| --- | --- | --- |
| `V1-pov-goutte` | 18,7 s | POV narratif : « tu es une goutte d'eau », compteur de volume qui fond, sas atteint, puis l'échec |
| `V2-etats-de-l-eau` | 17,1 s | Rythmé (phonk 130 BPM) : liquide, glace, vapeur, les murs qui boivent — coupes à la mesure |
| `V3-hypnotique` | 14,7 s | Satisfaisant/boucle : glace en orbite devant le hublot, éclats de glace, rebond |

## Les versions « musique du jeu »

Le réseau de l'environnement de fabrication ne joint aucune banque de
musique libre : l'autre musique possible était la bande-son du jeu
(`masters/sound/`). Tempo et premiers temps mesurés sur chaque morceau, le
passage choisi pour sa courbe d'énergie :

| Vidéo | Morceau | Tempo | Extrait |
| --- | --- | --- | --- |
| V1 | `temps-suspendu-v2` (Tension Held) | 85,7 BPM — montage recalé, 19,6 s | dès 0:41, retenu puis qui monte vers le sas |
| V2 | `zone-chambre-v2` (Warm Dark Rest) | 130 BPM — le tempo du montage | dès 2:02, entrée franche, intense de bout en bout |
| V3 | `zone-hublot-v2` (Frozen Hiss) | 99 BPM — montage recalé, 14,8 s | dès 1:04 — le hublot gelé, à l'image comme au titre |

Vérifié sur le morceau seul (V2) : les attaques tombent sur les temps, 14,2
contre ~1,3 entre les temps. V3 est une nappe sans pulsation marquée : le
calage y compte peu. Ces morceaux viennent de Suno : vérifier que l'offre
utilisée autorise un usage promotionnel avant de publier.

## Légendes à copier-coller

**V1 — POV goutte d'eau**

> POV : tu es une goutte d'eau et chaque mouvement te coûte un morceau de toi 💧 Tu irais jusqu'où ?
> #jeuvideo #indiegame #gamedev #physique #satisfying #pov #jeuindé #fyp

**V2 — Les états de l'eau**

> Liquide, glace, vapeur… et les murs ont soif 🧊💨 Le jeu où avancer te fait rétrécir.
> #indiegame #gamedev #jeuvideo #physics #phonk #gaming #fyp #pourtoi

**V3 — Hypnotique**

> Tu pourrais regarder ça en boucle ? 🌀 Une goutte de glace prise dans la gravité.
> #satisfying #oddlysatisfying #indiegame #physics #gamedev #asmr #fyp

## Conseils de publication

- Publier **un clip par jour**, en commençant par V2 (le plus nerveux).
- Les 2 premières secondes portent l'accroche : ne pas recadrer le début.
- Épingler un commentaire qui pose une question (« Liquide, glace ou vapeur ? »)
  — les réponses font remonter la vidéo.
- Les sous-titres restent dans la zone sûre (ni sous les boutons de droite,
  ni sous la description en bas).
