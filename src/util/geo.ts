/** Great-circle distance in meters between two WGS84 points. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Paris / Lyon / Marseille municipal arrondissements have their own INSEE
 * codes in BAN and DVF, but geo.api.gouv.fr only knows the parent commune.
 */
export function parentCommuneCode(insee: string): string {
  const n = Number(insee);
  if (n >= 75101 && n <= 75120) return "75056"; // Paris
  if (n >= 69381 && n <= 69389) return "69123"; // Lyon
  if (n >= 13201 && n <= 13216) return "13055"; // Marseille
  return insee;
}

/** Département code as used in geo-dvf file paths ("75", "2A", "971"...). */
export function departementFromInsee(insee: string): string {
  return insee.startsWith("97") ? insee.slice(0, 3) : insee.slice(0, 2);
}
