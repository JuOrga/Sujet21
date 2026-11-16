// ---- LES CHIFFRES À LA FRANÇAISE --------------------------------------------
// Vivaient dans main.ts. Le relevé de la descente (finDescente.ts) écrit les
// mêmes litres et les mêmes durées que le reste du jeu : deux copies auraient
// fini par diverger (un « 31.40 L » ici, un « 31,40 L » là). Déplacés tels
// quels, sortie inchangée (finDescente.spec.ts la garde).

export function fmtTime(s: number): string {
  return `${s.toFixed(1).replace('.', ',')} s`
}

// Les litres à la française : la virgule, pas le point
export function fmtL(l: number): string {
  return `${l.toFixed(2).replace('.', ',')} L`
}

// Les durées d'expédition se lisent en minutes : « 13:32 » plutôt que 812 s
export function fmtDuree(s: number): string {
  if (s < 120) return fmtTime(s)
  const mn = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${mn}:${String(sec).padStart(2, '0')}`
}
