// LES FANTÔMES DU PALMARÈS : la trace du détenteur de chaque record, servie
// à tous. Un document par salle (`fantomes/<code>/` : le VOLUME et le
// CHRONO, traces comprises — une centaine de kilo-octets) et un INDEX
// (`fantomes/index/` : par salle, qui tient quoi, sans les traces) pour
// que l'écran des records liste tout en UNE lecture.
//
// La règle est celle des registres : le meilleur gagne — le volume d'abord,
// le temps départage ; le chrono d'abord, les litres départagent. Une
// trace qui ne bat pas celle en place ne s'écrit pas : c'est ce qui rend
// l'écriture RARE, et le régime d'opérations du magasin (2 000 par mois)
// supportable — chaque prise de record coûte deux documents.
//
// Point d'accès ouvert, comme les records : un prototype semi-privé. Le
// jour d'une sortie publique, tout cela part dans les classements Steam.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ecritDocument, litDocument } from './_magasin.js'
import { poidsDocument } from './_budget.js'

type Cat = 'volume' | 'chrono'

interface Fantome {
  v: 1 | 2
  cadence: number
  n: number
  litres: number
  temps: number
  quand: string
  nom: string
  donnees: string
  ev?: number[]
}

interface Meta {
  nom: string
  litres: number
  temps: number
  quand: string
}

interface Salle {
  volume?: Fantome
  chrono?: Fantome
}

interface Index {
  salles: Record<string, { volume?: Meta; chrono?: Meta }>
}

const PREFIX_INDEX = 'fantomes/index/'
/** Le plafond d'une trace : une course de trois minutes pèse ~60 Ko ;
 *  au-delà de 400 Ko, ce n'est pas une course. */
const POIDS_MAX_TRACE = 400 * 1024

function prefixSalle(code: string): string {
  return `fantomes/salle-${code}/`
}

function codeDe(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const c = v.trim().slice(0, 16)
  return /^[A-Za-z0-9._-]+$/.test(c) ? c : null
}

function catDe(v: unknown): Cat | null {
  return v === 'volume' || v === 'chrono' ? v : null
}

function num(v: unknown, def: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : def
}

function litFantome(brut: unknown): Fantome | null {
  if (typeof brut !== 'object' || brut === null) return null
  const o = brut as Record<string, unknown>
  if ((o.v !== 1 && o.v !== 2) || typeof o.donnees !== 'string') return null
  const f: Fantome = {
    v: o.v,
    cadence: num(o.cadence, 0.1) || 0.1,
    n: Math.max(0, Math.floor(num(o.n, 0))),
    litres: Math.max(0, num(o.litres, 0)),
    temps: Math.max(0, num(o.temps, 0)),
    quand: typeof o.quand === 'string' ? o.quand : new Date().toISOString(),
    nom: typeof o.nom === 'string' ? o.nom.trim().toUpperCase().slice(0, 12) : '',
    donnees: o.donnees,
  }
  if (Array.isArray(o.ev) && o.ev.every((x) => typeof x === 'number')) f.ev = o.ev as number[]
  return f
}

function metaDe(f: Fantome): Meta {
  return { nom: f.nom, litres: f.litres, temps: f.temps, quand: f.quand }
}

/** La même règle que batLeFantome (src/game/fantome.ts). */
function bat(cat: Cat, nouveau: Fantome, ancien: Fantome | undefined): boolean {
  if (!ancien) return true
  if (cat === 'volume')
    return nouveau.litres > ancien.litres || (nouveau.litres === ancien.litres && nouveau.temps < ancien.temps)
  return nouveau.temps < ancien.temps || (nouveau.temps === ancien.temps && nouveau.litres > ancien.litres)
}

function valideSalle(data: unknown): boolean {
  return data !== null && typeof data === 'object'
}
function valideIndex(data: unknown): boolean {
  return data !== null && typeof data === 'object' && typeof (data as Index).salles === 'object'
}

async function litSalle(code: string, frais = false): Promise<Salle> {
  const data = (await litDocument(prefixSalle(code), valideSalle, { frais })) as Record<string, unknown> | null
  if (!data) return {}
  const out: Salle = {}
  const v = litFantome(data.volume)
  const c = litFantome(data.chrono)
  if (v) out.volume = v
  if (c) out.chrono = c
  return out
}

async function litIndex(frais = false): Promise<Index> {
  const data = (await litDocument(PREFIX_INDEX, valideIndex, { frais })) as Index | null
  return data ? { salles: data.salles ?? {} } : { salles: {} }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      const code = codeDe(req.query.code)
      if (code) res.status(200).json(await litSalle(code))
      else res.status(200).json(await litIndex())
      return
    }
    if (req.method === 'POST') {
      const body = (req.body ?? {}) as Record<string, unknown>
      const code = codeDe(body.code)
      const cat = catDe(body.cat)
      const fantome = litFantome(body.fantome)
      if (!code || !cat || !fantome || !fantome.nom) {
        res.status(400).json({ error: 'fantôme invalide : code, catégorie, trace et opérateur requis' })
        return
      }
      if (poidsDocument(fantome) > POIDS_MAX_TRACE) {
        res.status(413).json({ error: 'trace trop lourde pour un fantôme' })
        return
      }
      const salle = await litSalle(code, true)
      if (!bat(cat, fantome, salle[cat])) {
        // rien d'écrit : la trace en place tient — on répond l'état, sans opération
        res.status(200).json({ garde: false, salle })
        return
      }
      salle[cat] = fantome
      await ecritDocument(prefixSalle(code), salle)
      const index = await litIndex(true)
      const entree = index.salles[code] ?? (index.salles[code] = {})
      entree[cat] = metaDe(fantome)
      await ecritDocument(PREFIX_INDEX, index)
      res.status(200).json({ garde: true, salle, index })
      return
    }
    res.setHeader('Allow', 'GET, POST')
    res.status(405).json({ error: 'méthode non permise' })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'erreur du magasin' })
  }
}
