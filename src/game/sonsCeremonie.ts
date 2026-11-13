// ---- LES VOIX SONORES DE LA CÉRÉMONIE --------------------------------------
// Le contrat : le nom des voix que la cérémonie peut réclamer. `AudioFx`
// (audio.ts) les joue, `main.ts` les appelle par `sonCeremonie`. La table des
// recettes est vide pour l'instant : elle se remplit voix par voix, et une
// voix sans recette reste muette plutôt que de planter la cérémonie.

export type VoixCeremonie =
  | 'compteur'
  | 'sceau'
  | 'cartouche'
  | 'deversement'
  | 'palier'
  | 'elu'
  | 'levier'

/** Une recette synthétise la voix sur le contexte et le bus donnés ; `force`
 *  (0..1) dose l'intensité, `t0` est l'instant de départ du contexte. */
export type RecetteVoix = (ctx: AudioContext, bus: AudioNode, force: number, t0: number) => void

export const RECETTES_CEREMONIE: Partial<Record<VoixCeremonie, RecetteVoix>> = {}
