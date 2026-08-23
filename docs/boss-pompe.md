# LA POMPE DE REPRISE — esquisse du premier boss

Le principe retenu : dans Sujet 21, un boss n'est pas une créature, c'est **une
salle qui se défend**. La station a été conçue pour confiner un fluide ; quand
il s'échappe, elle a forcément une contre-mesure. La Pompe est cette
contre-mesure : la dernière machine entre l'échantillon et le sas de l'acte 0.

La règle d'or du combat : **la punition n'est jamais « recommence », elle est
« ton eau est là-bas, va la reprendre »**. La Pompe ne détruit pas une goutte —
elle les vole, les stocke dans une cuve visible, et tout se récupère en la
crevant. « Rien ne se perd » devient le climax du combat.

---

## 1. La fiction

Fin d'acte 0. L'échantillon a traversé le module en ruine, le sas est en vue —
et la station se réveille une dernière fois : `REPRISE DE L'ÉCHANTILLON —
PROTOCOLE 21-R`. La salle devant le sas est une station de pompage : une bouche
d'aspiration au centre, une cuve de rétention transparente, et la porte du sas
scellée tant que la Pompe tourne. Les Créateurs ne sont plus là ; leur machine,
si.

## 2. Le tableau (esquisse)

Cuve standard 2400×1500. Lecture de gauche à droite :

```
 entrée                    LA POMPE                        sas scellé
   ●  →   chicane   →   [prise A]  ◄bouche►  [cuve de     ▓▓ porte
          (couvert)     [prise B]   aspire    rétention]   ▓▓ canal -1
                        récepteur 1 (membrane : EAU)
                        récepteur 2 (rideau : GLACE)
```

- **La bouche** : au centre-droit, un courant permanent tire tout ce qui est
  liquide vers la grille d'admission. Ce qui la franchit est **volé** : retiré
  du corps, compté dans la cuve de rétention (jauge visible qui monte).
- **Le couvert** : une chicane de parois pleines à gauche — des positions où
  le courant ne porte pas. On y reprend son souffle, on y planifie. Le combat
  alterne exposition (agir) et couvert (récupérer).
- **Récepteur 1** derrière une **membrane** (seule l'EAU passe) : il faut
  s'exposer au courant en liquide pour l'atteindre. TOR : un passage du
  faisceau reflété/réfracté l'allume pour de bon — phase 1 tombée.
- **Récepteur 2** derrière un **rideau** (seule la GLACE l'écarte) : gelé, on
  est trop inerte pour le courant mais lent à manœuvrer. TOR — phase 2 tombée.
- **La cuve de rétention** : accolée à la Pompe, elle affiche ce qu'elle a
  volé (fioles, jauge). Les deux récepteurs tombés (règle `et`), la séquence
  finale la crève : **tout le volume volé ressort en gouttes libres** — on le
  reboit par contact, comme la rosée — et la brèche ouvre la porte du sas.
- **L'échec** n'existe pas comme mort instantanée : la Pompe qui a presque
  tout bu laisse le sursis habituel du corps défait — mais tant qu'il reste
  une goutte pilotable, tout est encore reprenable dans la cuve.

## 3. Les phases — avec le vocabulaire de séquence EXISTANT

Le séquenceur (src/game/sequence.ts) sait déjà : `lampes` (teinte + gain),
`bruitage`, `ponctuation`, `piste`, `breche` (porte scénarisée, canal négatif),
`carte`, `secousse`, `cinematique`. Trois séquences suffisent :

**POMPE-ENTREE** (jouée à l'entrée du tableau, `level.sequence`) :
lampes orange 130 % → carte « REPRISE DE L'ÉCHANTILLON ENGAGÉE » →
ponctuation `sting-derniere-impulsion` → secousse → la Pompe démarre (débit
faible). La piste bascule sur `zone-conduite`.

**POMPE-BLESSEE** (déclenchée quand le récepteur 1 s'allume) :
secousse + `impact-glace` → lampes qui clignotent (2 étapes lampes) → carte
« ADMISSION PRINCIPALE EN DÉFAUT » → la Pompe reprend, débit renforcé (la
machine blessée force).

**POMPE-CREVEE** (déclenchée quand le canal `et` des deux récepteurs s'allume) :
grande secousse + `impact-glace` → la cuve relâche tout le volume volé →
lampes vertes calmes → carte « Rien ne se perd. » → `breche` 0 : la porte du
sas s'ouvre → ponctuation `sting-collecte`.

## 4. Ce que le moteur sait DÉJÀ faire

| Brique | Où | État |
| --- | --- | --- |
| Champ d'aspiration (entonnoir Rankine, prise réduite sur la glace) | `applyExitSuction`, solver | livré — mais UNE seule bouche, celle du sas, et boire = collecter |
| Matière volée/rendue : gouttes libres `KIND_FREE`, reprise par contact | `addParticle`, rosée des plaques froides | livré — la boucle « perdre puis reboire » existe (dépôt de givre) |
| Portes scénarisées (canal négatif) ouvertes par `breche` | PorteDef + Sequenceur | livré |
| Récepteurs TOR (à verrou, sans retour) et règle `et` multi-pastilles | CibleDef/PorteDef | livré — parfait pour des phases irréversibles |
| Membrane (eau seule) et rideau (glace seule) devant les récepteurs | MAT_MEMBRANE / MAT_RIDEAU | livré |
| Mise en scène : lampes, secousse, cartes, sons, brume, noir | Sequenceur + éclairage 2026 | livré |
| Séquence à l'entrée du tableau et à l'entrée d'une zone | LevelDef.sequence, ZoneDef.sequence | livré |

## 5. Ce qui MANQUE réellement — le chantier, dans l'ordre

**A. La bouche hostile (le gros morceau).** Un élément `PompeDef {x, y, rayon,
debit}` posable à l'éditeur : même champ d'aspiration que le sas, mais ce qui
franchit sa grille d'admission est RETIRÉ du corps et compté dans sa cuve —
sans toucher à la logique de collecte du sas (victoire, bonbonne, alarmes),
qui est câblée sur l'unique bouche actuelle (`mouthX/mouthY, drainOn`).
Solveur (multi-bouches + compteur volé), boucle de jeu, jauge de cuve à
l'écran. C'est le seul vrai chantier moteur.

**B. Les déclencheurs d'état.** Aujourd'hui une séquence part à l'entrée du
tableau ou d'une zone. Il manque : « quand le canal N s'allume → séquence X »
(un champ `sequence` sur la cible, lu là où les canaux sont déjà suivis).
Petit — et il servira bien au-delà du boss (toute salle laser gagnera une
mise en scène de réussite).

**C. Deux actions de séquence.** `pompe` (valeur = débit en %, 0 = coupée)
pour que les phases pilotent la machine, et `relache` (la cuve rend son volume
en gouttes libres à sa position — le chemin de la rosée fait déjà exactement
ça). Petit : le vocabulaire fermé du séquenceur est fait pour être étendu.

**D. (Optionnel, v2) Boucher une prise en gelant dessus.** Se plaquer gelé sur
une admission pour la neutraliser tant qu'on y reste. Belle idée de contre-jeu
physique, mais pas nécessaire à la v1 : les récepteurs suffisent comme
contre-attaque. À garder pour la deuxième passe.

Estimation honnête : A vaut deux à trois livraisons ; B et C tiennent dans une
seule ; le tableau lui-même est de la donnée d'éditeur. Aucune de ces briques
n'est jetable : multi-bouches, déclencheurs de canal et actions de séquence
resserviront (Semblable, salles laser, hub).

## 6. Ce que ça enseigne (pourquoi ce boss-là)

Le combat force les trois états dans l'ordre du jeu — liquide pour la membrane,
glace pour le rideau, et la gestion du volume comme ressource unique du début à
la fin. Il conclut l'acte 0 sur la phrase du jeu : tout ce qui passe compte,
rien ne se perd. Et il annonce en creux le boss d'après-démo : une machine qui
vole l'eau aujourd'hui, un Semblable qui se bat pour la même eau demain.
