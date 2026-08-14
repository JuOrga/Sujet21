// Solveur de fluide « Position Based Fluids » 2D, sans gravité — portage C
// du solveur de js/fluid.js, compilé en WebAssembly par build.sh.
// Même modèle : la contrainte de densité n'est pas bornée, une région trop
// peu dense attire ses voisines — la cohésion du corps (tension de surface)
// est un comportement du modèle, pas une règle (§2.3).
//
// Seule la partie chaude est portée : recherche de voisins, contrainte de
// densité, corrections de position, viscosité XSPH. La logique de jeu
// (éjection, amas joueur, éponge, chaleur, glace) reste en JavaScript.
//
// Convention mémoire : tous les tableaux sont statiques ; les accesseurs
// *_ptr() donnent leur adresse et JS les lit/écrit directement via des vues
// Float32Array/Uint8Array sur la mémoire du module. Le nombre de particules
// n est géré côté JS (add/remove/clear) et passé en argument.
//
// Les calculs se font en double (comme les nombres JavaScript) et les
// tableaux stockent en float (comme les Float32Array d'origine), pour
// rester au plus près du comportement du solveur de référence.

#define EXPORT(name) __attribute__((export_name(name)))

#define MAX 4000
#define MAXW 64
#define NBR_CAP 96
#define TABLE 4096 // puissance de deux (masque)

static float x[MAX], y[MAX], vx[MAX], vy[MAX];
static float px[MAX], py[MAX];
static float lam[MAX], dpx[MAX], dpy[MAX], nvx[MAX], nvy[MAX];
static float mergeTimer[MAX]; // > 0 : goutte fraîchement éjectée
static float ballistic[MAX];  // > 0 : découplée du fluide (en cours de détachement)
static float spongeT[MAX];    // temps de contact continu avec l'éponge
static float temp[MAX];       // température normalisée (0 = gel, 1 = ébullition)
static unsigned char frozen[MAX]; // 1 : particule prise dans le corps gelé (hors solveur)

static float walls[MAXW * 4]; // x, y, w, h par paroi
static int wallCount = 0;
static double boundsX, boundsY, boundsW, boundsH;

// Paramètres du pas courant, poussés par JS avant chaque step()/calibrate()
// (le banc de réglage les modifie en direct).
static double Ph = 14, Peps = 0.01, PsCorrK = 0.08, PsCorrDq = 0.25;
static double Pvisc = 0.18, PmaxSpeed = 1400;
static int Piter = 3;

static double rho0 = 1; // calibrée après le spawn

// Grille de hachage spatial : tri par comptage dans TABLE seaux.
static int cellStart[TABLE + 1];
static int cursor[TABLE];
static int cellEntry[MAX];
static int nbr[MAX][NBR_CAP]; // listes de voisins, réutilisées
static int nbrN[MAX];

static double dsqrt(double v) { return __builtin_sqrt(v); }
static int ifloor(double v) { int i = (int)v; return (double)i > v ? i - 1 : i; }

static unsigned hashCell(int cx, int cy) {
  unsigned h = (unsigned)(cx * 73856093) ^ (unsigned)(cy * 19349663);
  return h & (TABLE - 1);
}

static void gridBuild(int n, double cell) {
  for (int k = 0; k <= TABLE; k++) cellStart[k] = 0;
  for (int i = 0; i < n; i++)
    cellStart[hashCell(ifloor(px[i] / cell), ifloor(py[i] / cell)) + 1]++;
  for (int k = 0; k < TABLE; k++) cellStart[k + 1] += cellStart[k];
  for (int k = 0; k < TABLE; k++) cursor[k] = cellStart[k];
  // remplissage stable : chaque seau garde les indices en ordre croissant
  for (int i = 0; i < n; i++) {
    unsigned k = hashCell(ifloor(px[i] / cell), ifloor(py[i] / cell));
    cellEntry[cursor[k]++] = i;
  }
}

// Noyaux non normalisés ; les constantes sont absorbées par la calibration de rho0.
static double wPoly6(double r2, double h2) { double q = 1 - r2 / h2; return q * q * q; } // W(0) = 1
static double dwSpiky(double r, double h)  { double q = 1 - r / h;  return -(q * q) / h; } // dW/dr <= 0

static void findNeighbors(int n) {
  double h = Ph, h2 = h * h;
  gridBuild(n, h);
  for (int i = 0; i < n; i++) {
    nbrN[i] = 0;
    // en vol libre ou gelée : aucun couplage fluide (la glace est rigide)
    if (ballistic[i] > 0 || frozen[i]) continue;
    double xi = px[i], yi = py[i];
    int x0 = ifloor((xi - h) / h), x1 = ifloor((xi + h) / h);
    int y0 = ifloor((yi - h) / h), y1 = ifloor((yi + h) / h);
    // seaux du disque de rayon h ; dédoublonnés, deux cellules distinctes
    // pouvant partager un seau (collision de hachage)
    unsigned seen[16];
    int seenN = 0;
    for (int cx = x0; cx <= x1; cx++)
      for (int cy = y0; cy <= y1; cy++) {
        unsigned k = hashCell(cx, cy);
        int dup = 0;
        for (int s = 0; s < seenN; s++) if (seen[s] == k) { dup = 1; break; }
        if (dup) continue;
        if (seenN < 16) seen[seenN++] = k;
        for (int e = cellStart[k]; e < cellStart[k + 1]; e++) {
          int j = cellEntry[e];
          if (j == i || ballistic[j] > 0 || frozen[j]) continue;
          double dx = xi - px[j], dy = yi - py[j];
          if (dx * dx + dy * dy < h2 && nbrN[i] < NBR_CAP) nbr[i][nbrN[i]++] = j;
        }
      }
  }
}

static double density(int i, double h2) {
  double rho = 1; // contribution propre
  for (int m = 0; m < nbrN[i]; m++) {
    int j = nbr[i][m];
    double dx = px[i] - px[j], dy = py[i] - py[j];
    rho += wPoly6(dx * dx + dy * dy, h2);
  }
  return rho;
}

static void collide(int i) {
  double m = 4;
  if (px[i] < boundsX + m) px[i] = boundsX + m;
  if (px[i] > boundsX + boundsW - m) px[i] = boundsX + boundsW - m;
  if (py[i] < boundsY + m) py[i] = boundsY + m;
  if (py[i] > boundsY + boundsH - m) py[i] = boundsY + boundsH - m;
  for (int w = 0; w < wallCount; w++) {
    double Wx = walls[w * 4], Wy = walls[w * 4 + 1];
    double Ww = walls[w * 4 + 2], Wh = walls[w * 4 + 3];
    if (px[i] > Wx && px[i] < Wx + Ww && py[i] > Wy && py[i] < Wy + Wh) {
      // projection vers la face la plus proche
      double dl = px[i] - Wx, dr = Wx + Ww - px[i];
      double dt = py[i] - Wy, db = Wy + Wh - py[i];
      double min = dl;
      if (dr < min) min = dr;
      if (dt < min) min = dt;
      if (db < min) min = db;
      if (min == dl) px[i] = Wx;
      else if (min == dr) px[i] = Wx + Ww;
      else if (min == dt) py[i] = Wy;
      else py[i] = Wy + Wh;
    }
  }
}

static void substep(int n, double sdt) {
  double h = Ph, h2 = h * h;
  for (int i = 0; i < n; i++) {
    // les particules gelées sont déplacées en bloc rigide par le jeu
    if (frozen[i]) { px[i] = x[i]; py[i] = y[i]; continue; }
    px[i] = x[i] + vx[i] * sdt;
    py[i] = y[i] + vy[i] * sdt;
  }
  findNeighbors(n);

  double wDq = wPoly6(PsCorrDq * PsCorrDq * h2, h2);
  for (int it = 0; it < Piter; it++) {
    // multiplicateurs de Lagrange
    for (int i = 0; i < n; i++) {
      double rho = 1, sgx = 0, sgy = 0, sum2 = 0;
      for (int m = 0; m < nbrN[i]; m++) {
        int j = nbr[i][m];
        double dx = px[i] - px[j], dy = py[i] - py[j];
        double r2 = dx * dx + dy * dy;
        double r = dsqrt(r2);
        rho += wPoly6(r2, h2);
        if (r > 1e-6) {
          double g = dwSpiky(r, h) / rho0;
          double gx = g * dx / r, gy = g * dy / r;
          sgx += gx; sgy += gy;
          sum2 += gx * gx + gy * gy;
        }
      }
      sum2 += sgx * sgx + sgy * sgy;
      lam[i] = -(rho / rho0 - 1) / (sum2 + Peps);
    }
    // corrections de position
    for (int i = 0; i < n; i++) {
      double sx = 0, sy = 0;
      for (int m = 0; m < nbrN[i]; m++) {
        int j = nbr[i][m];
        double dx = px[i] - px[j], dy = py[i] - py[j];
        double r2 = dx * dx + dy * dy;
        double r = dsqrt(r2);
        if (r > 1e-6) {
          double q = wPoly6(r2, h2) / wDq;
          double q2 = q * q;
          double sc = -PsCorrK * q2 * q2; // (w/wDq)^4
          double s = (lam[i] + lam[j] + sc) * dwSpiky(r, h) / rho0;
          sx += s * dx / r; sy += s * dy / r;
        }
      }
      dpx[i] = sx; dpy[i] = sy;
    }
    for (int i = 0; i < n; i++) {
      if (frozen[i]) continue;
      px[i] += dpx[i]; py[i] += dpy[i];
      collide(i);
    }
  }

  // vitesse depuis les positions + viscosité XSPH (symétrique : conserve la q. de mvt)
  for (int i = 0; i < n; i++) {
    if (frozen[i]) continue; // la vitesse du bloc gelé est gérée par le jeu
    vx[i] = (px[i] - x[i]) / sdt;
    vy[i] = (py[i] - y[i]) / sdt;
  }
  for (int i = 0; i < n; i++) { nvx[i] = 0; nvy[i] = 0; }
  for (int i = 0; i < n; i++) {
    for (int m = 0; m < nbrN[i]; m++) {
      int j = nbr[i][m];
      if (j < i) continue; // chaque paire une seule fois
      double dx = px[i] - px[j], dy = py[i] - py[j];
      double w = wPoly6(dx * dx + dy * dy, h2);
      double fx = (vx[j] - vx[i]) * w, fy = (vy[j] - vy[i]) * w;
      nvx[i] += fx; nvy[i] += fy;
      nvx[j] -= fx; nvy[j] -= fy;
    }
  }
  double c = Pvisc;
  for (int i = 0; i < n; i++) {
    if (frozen[i]) continue;
    vx[i] += c * nvx[i]; vy[i] += c * nvy[i];
    double sp = dsqrt((double)vx[i] * vx[i] + (double)vy[i] * vy[i]);
    if (sp > PmaxSpeed) { vx[i] *= PmaxSpeed / sp; vy[i] *= PmaxSpeed / sp; }
    x[i] = px[i]; y[i] = py[i];
  }
}

EXPORT("set_params")
void set_params(double h, double eps, double sCorrK, double sCorrDq,
                double viscosity, double maxSpeed, int iterations) {
  Ph = h; Peps = eps; PsCorrK = sCorrK; PsCorrDq = sCorrDq;
  Pvisc = viscosity; PmaxSpeed = maxSpeed;
  Piter = iterations < 1 ? 1 : iterations;
}

EXPORT("set_bounds")
void set_bounds(double bx, double by, double bw, double bh) {
  boundsX = bx; boundsY = by; boundsW = bw; boundsH = bh;
}

EXPORT("set_wall_count")
void set_wall_count(int c) {
  wallCount = c < 0 ? 0 : (c > MAXW ? MAXW : c);
}

EXPORT("step")
void step(int n, double dt, int substeps) {
  if (substeps < 1) substeps = 1;
  for (int k = 0; k < substeps; k++) substep(n, dt / substeps);
  for (int i = 0; i < n; i++) {
    if (mergeTimer[i] > 0) mergeTimer[i] -= dt;
    if (ballistic[i] > 0) ballistic[i] -= dt;
  }
}

// Après le spawn : la densité de repos = densité médiane des particules intérieures.
EXPORT("calibrate")
void calibrate(int n) {
  for (int i = 0; i < n; i++) { px[i] = x[i]; py[i] = y[i]; }
  findNeighbors(n);
  static double interior[MAX];
  int m = 0;
  double h2 = Ph * Ph;
  for (int i = 0; i < n; i++)
    if (nbrN[i] >= 6) interior[m++] = density(i, h2);
  // tri par insertion : une seule fois par tentative, n reste petit
  for (int a = 1; a < m; a++) {
    double v = interior[a];
    int b = a;
    while (b > 0 && interior[b - 1] > v) { interior[b] = interior[b - 1]; b--; }
    interior[b] = v;
  }
  rho0 = m ? interior[m / 2] : 4;
}

EXPORT("max_particles") int max_particles(void) { return MAX; }
EXPORT("max_walls")     int max_walls(void)     { return MAXW; }

EXPORT("x_ptr")         float *x_ptr(void)         { return x; }
EXPORT("y_ptr")         float *y_ptr(void)         { return y; }
EXPORT("vx_ptr")        float *vx_ptr(void)        { return vx; }
EXPORT("vy_ptr")        float *vy_ptr(void)        { return vy; }
EXPORT("merge_ptr")     float *merge_ptr(void)     { return mergeTimer; }
EXPORT("ballistic_ptr") float *ballistic_ptr(void) { return ballistic; }
EXPORT("sponge_ptr")    float *sponge_ptr(void)    { return spongeT; }
EXPORT("temp_ptr")      float *temp_ptr(void)      { return temp; }
EXPORT("frozen_ptr")    unsigned char *frozen_ptr(void) { return frozen; }
EXPORT("walls_ptr")     float *walls_ptr(void)     { return walls; }
