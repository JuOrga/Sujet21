# Les masters des images

Ici vont les **sources en pleine résolution** (PNG, JPG, WebP, TIFF) telles
que le générateur ou le concepteur les livre, sous le nom que le jeu
attend, avec le même chemin relatif que dans `public/assets/` :

```
masters/images/decal-vanne.png        →  public/assets/decal-vanne.webp
masters/images/cine/ouverture-1.png   →  public/assets/cine/ouverture-1.webp
```

Puis :

```bash
python3 tools/images/prepare.py                # tout
python3 tools/images/prepare.py decal-vanne    # une seule
```

Le script redimensionne à la taille de la famille, encode en WebP à sa
qualité, et **mesure** : raccord, luminance, palette, bord des pièces
détourées, poids (`docs/charte-visuelle.md` §7). Une image hors mesure
n'est pas livrée : on refait le master, ou on passe `--recadre` si seul
le rapport ne correspond pas.

**Ce dossier n'est pas versionné**, à la différence des masters du son :
un PNG de 2048² pèse 5 à 8 Mo, cinquante font le poids du dépôt entier.
Seuls les WebP de `public/assets/` partent dans Git. Gardez vos masters
sur votre machine (et une copie ailleurs) ; ce fichier est le seul du
dossier qui voyage.
