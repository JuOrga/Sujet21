// Les types de places.js, pour que le jeu (TypeScript strict) puisse le tester.
export const GRACE_MS: number
export const JETON: RegExp
export const DEBIT_MAX: number
export const PATIENCE_DEBIT: number
export const CONNEXIONS_PAR_ADRESSE: number
export interface Salon<C = unknown> {
  hote: C | null
  invite: C | null
  jetons: { hote: string; invite: string }
  quitte: { hote: number; invite: number }
}
export type Role = 'hote' | 'invite'
export function salonNeuf<C = unknown>(): Salon<C>
export function admet(salon: Salon, role: Role, jeton: string, maintenant: number): boolean
export function occupe<C>(salon: Salon<C>, role: Role, connexion: C, jeton: string): void
export function quitte(salon: Salon, role: Role, maintenant: number): void
export function debit(max?: number, patience?: number): { compte(taille: number, maintenant: number): 'passe' | 'jette' | 'coupe' }
export function adresseDe(entetes: Record<string, string | string[] | undefined>, repli?: string): string
