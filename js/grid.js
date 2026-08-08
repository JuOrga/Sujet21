"use strict";

// Grille de hachage spatial pour la recherche de voisins.
class HashGrid {
  constructor() {
    this.cell = 1;
    this.map = new Map();
  }
  key(cx, cy) {
    return cx * 65536 + cy; // coordonnées de cellule toujours >= 0 dans ce monde
  }
  build(xs, ys, n, cell) {
    this.cell = cell;
    this.map.clear();
    for (let i = 0; i < n; i++) {
      const k = this.key(Math.floor(xs[i] / cell), Math.floor(ys[i] / cell));
      let a = this.map.get(k);
      if (!a) { a = []; this.map.set(k, a); }
      a.push(i);
    }
  }
  // Appelle cb(j) pour tout point des cellules couvrant le disque (x, y, r).
  query(x, y, r, cb) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const a = this.map.get(this.key(cx, cy));
        if (a) for (let m = 0; m < a.length; m++) cb(a[m]);
      }
  }
}
