import { fetchJson } from "../http.js";

const BASE = "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines";

const SELECT = [
  "adresse_ban",
  "identifiant_ban",
  "etiquette_dpe",
  "etiquette_ges",
  "type_batiment",
  "annee_construction",
  "surface_habitable_logement",
  "date_etablissement_dpe",
  "conso_5_usages_par_m2_ep",
].join(",");

export interface DpeRecord {
  adresse_ban?: string;
  identifiant_ban?: string;
  etiquette_dpe?: string;
  etiquette_ges?: string;
  type_batiment?: string;
  annee_construction?: number;
  surface_habitable_logement?: number;
  date_etablissement_dpe?: string;
  conso_5_usages_par_m2_ep?: number;
}

interface DpeResponse {
  total: number;
  results: DpeRecord[];
}

/** Exact match on the BAN interoperability id (e.g. "75102_6998_00010"). */
export async function dpeByBanId(banId: string, size = 20): Promise<DpeResponse> {
  const url = `${BASE}?size=${size}&qs=${encodeURIComponent(`identifiant_ban:"${banId}"`)}&select=${SELECT}&sort=-date_etablissement_dpe`;
  return fetchJson<DpeResponse>(url);
}

/** Fuzzy search on the BAN address, restricted to one commune. */
export async function dpeByAddress(address: string, inseeCode: string, size = 20): Promise<DpeResponse> {
  const params = new URLSearchParams({
    size: String(size),
    q: address,
    q_fields: "adresse_ban",
    qs: `code_insee_ban:"${inseeCode}"`,
    select: SELECT,
    sort: "-date_etablissement_dpe",
  });
  return fetchJson<DpeResponse>(`${BASE}?${params.toString()}`);
}
