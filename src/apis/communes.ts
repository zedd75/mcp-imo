import { fetchJson } from "../http.js";
import { parentCommuneCode } from "../util/geo.js";

const BASE = "https://geo.api.gouv.fr";
const FIELDS = "nom,code,codesPostaux,codeDepartement,codeRegion,population,surface,centre,departement,region";

export interface CommuneInfo {
  nom: string;
  code: string;
  codesPostaux?: string[];
  codeDepartement?: string;
  codeRegion?: string;
  population?: number;
  /** Hectares (as returned by geo.api.gouv.fr). */
  surface?: number;
  centre?: { coordinates: [number, number] };
  departement?: { code: string; nom: string };
  region?: { code: string; nom: string };
}

export async function communeByCode(inseeCode: string): Promise<CommuneInfo> {
  const code = parentCommuneCode(inseeCode);
  return fetchJson<CommuneInfo>(`${BASE}/communes/${code}?fields=${FIELDS}`);
}

export async function communesByName(name: string, limit = 5): Promise<CommuneInfo[]> {
  const url = `${BASE}/communes?nom=${encodeURIComponent(name)}&fields=${FIELDS}&limit=${limit}&boost=population`;
  return fetchJson<CommuneInfo[]>(url);
}
