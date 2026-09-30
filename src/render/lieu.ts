// OÙ JOUE LE JOUEUR — pour la vue « au-dessus de chez vous » du ciel TERRE
// (render/terre.ts) : la Terre montrée est la sienne, à son heure.
//
// SANS GÉOLOCALISATION. Demander la position ouvrirait une fenêtre de
// permission pour un fond d'écran — hors de proportion. Le FUSEAU HORAIRE du
// navigateur suffit : il dit la région (« Europe/Paris »), et c'est la
// région qui compte — le disque fait 12 700 km, une ville près ou loin n'y
// change rien. Une table des fuseaux courants donne leur ville ; pour les
// autres, la longitude se déduit du décalage STANDARD (heure d'hiver : 15°
// par heure), la latitude du continent nommé dans le fuseau.

export interface Lieu {
  lat: number
  lon: number
  /** d'où vient la position : la table, ou l'estimation par le décalage */
  source: 'table' | 'decalage'
}

// latitude, longitude de la ville qui donne son nom au fuseau
const FUSEAUX: Record<string, [number, number]> = {
  'Europe/Paris': [48.86, 2.35],
  'Europe/London': [51.51, -0.13],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Luxembourg': [49.61, 6.13],
  'Europe/Monaco': [43.73, 7.42],
  'Europe/Zurich': [47.38, 8.54],
  'Europe/Berlin': [52.52, 13.4],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Prague': [50.08, 14.44],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Budapest': [47.5, 19.04],
  'Europe/Bucharest': [44.43, 26.1],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Kyiv': [50.45, 30.52],
  'Europe/Kiev': [50.45, 30.52],
  'Europe/Moscow': [55.76, 37.62],
  'Europe/Stockholm': [59.33, 18.07],
  'Europe/Oslo': [59.91, 10.75],
  'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Helsinki': [60.17, 24.94],
  'Africa/Casablanca': [33.57, -7.59],
  'Africa/Algiers': [36.75, 3.06],
  'Africa/Tunis': [36.81, 10.18],
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Dakar': [14.72, -17.47],
  'Africa/Abidjan': [5.36, -4.01],
  'Africa/Lagos': [6.52, 3.38],
  'Africa/Kinshasa': [-4.44, 15.27],
  'Africa/Nairobi': [-1.29, 36.82],
  'Africa/Johannesburg': [-26.2, 28.05],
  'America/New_York': [40.71, -74.01],
  'America/Toronto': [43.65, -79.38],
  'America/Montreal': [45.5, -73.57],
  'America/Chicago': [41.88, -87.63],
  'America/Denver': [39.74, -104.99],
  'America/Phoenix': [33.45, -112.07],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Vancouver': [49.28, -123.12],
  'America/Anchorage': [61.22, -149.9],
  'America/Mexico_City': [19.43, -99.13],
  'America/Bogota': [4.71, -74.07],
  'America/Lima': [-12.05, -77.04],
  'America/Santiago': [-33.45, -70.67],
  'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38],
  'America/Martinique': [14.6, -61.07],
  'America/Guadeloupe': [16.24, -61.53],
  'America/Cayenne': [4.93, -52.33],
  'Pacific/Honolulu': [21.31, -157.86],
  'Pacific/Tahiti': [-17.53, -149.57],
  'Pacific/Noumea': [-22.28, 166.46],
  'Pacific/Auckland': [-36.85, 174.76],
  'Indian/Reunion': [-20.88, 55.45],
  'Indian/Mayotte': [-12.78, 45.23],
  'Asia/Dubai': [25.2, 55.27],
  'Asia/Tehran': [35.69, 51.39],
  'Asia/Jerusalem': [31.78, 35.22],
  'Asia/Beirut': [33.89, 35.5],
  'Asia/Karachi': [24.86, 67.01],
  'Asia/Kolkata': [22.57, 88.36],
  'Asia/Bangkok': [13.76, 100.5],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Manila': [14.6, 120.98],
  'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Tokyo': [35.68, 139.69],
  'Australia/Perth': [-31.95, 115.86],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Sydney': [-33.87, 151.21],
}

// la latitude probable d'un fuseau absent de la table, d'après son continent
const LATITUDE_CONTINENT: Record<string, number> = {
  Europe: 48,
  Africa: 5,
  America: 30,
  Asia: 30,
  Australia: -30,
  Pacific: -15,
  Indian: -15,
  Atlantic: 30,
  Antarctica: -75,
  Arctic: 75,
}

/**
 * La région du joueur. `fuseau` : l'IANA du navigateur
 * (Intl.DateTimeFormat().resolvedOptions().timeZone) ; `decalageStandardMin` :
 * le décalage de l'heure d'HIVER, en minutes À L'EST de UTC (+60 pour
 * Paris) — l'heure d'été ajouterait 15° de trop.
 */
export function lieuDuJoueur(fuseau: string | undefined, decalageStandardMin: number): Lieu {
  const connu = fuseau ? FUSEAUX[fuseau] : undefined
  if (connu) return { lat: connu[0], lon: connu[1], source: 'table' }
  const continent = fuseau?.split('/')[0] ?? ''
  let lat = LATITUDE_CONTINENT[continent] ?? 0
  // l'Amérique va d'un pôle à l'autre : le sud a ses fuseaux nommés
  if (continent === 'America' && /Argentina|Sao_Paulo|Santiago|Montevideo|Asuncion|La_Paz/.test(fuseau ?? ''))
    lat = -25
  let lon = (decalageStandardMin / 60) * 15
  lon = ((lon + 540) % 360) - 180
  return { lat, lon, source: 'decalage' }
}

/** Le décalage standard (heure d'hiver) de ce navigateur, en minutes à l'est
 *  de UTC : le plus petit des décalages de janvier et de juillet — l'heure
 *  d'été avance toujours l'horloge, quel que soit l'hémisphère. */
export function decalageStandardMin(annee: number): number {
  const janvier = -new Date(annee, 0, 1).getTimezoneOffset()
  const juillet = -new Date(annee, 6, 1).getTimezoneOffset()
  return Math.min(janvier, juillet)
}
