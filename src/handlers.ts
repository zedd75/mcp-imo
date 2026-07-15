import { geocode, geocodeBest, reverseGeocode, GeocodeResult } from "./apis/ban.js";
import {
  DVF_YEARS,
  fetchCommune,
  groupMutations,
  withinRadius,
  Mutation,
} from "./apis/dvf.js";
import { dpeByAddress, dpeByBanId } from "./apis/dpe.js";
import { riskReport } from "./apis/georisques.js";
import { communeByCode, communesByName } from "./apis/communes.js";
import { median, mean, quantile, round } from "./util/stats.js";

const DVF_SOURCE =
  "DVF (Demandes de valeurs foncières), DGFiP / Etalab — actual notarized sales. Alsace-Moselle and Mayotte are not covered.";

// Guard against DVF data-entry noise (1 € sales, whole-building deeds mistyped...).
const PRICE_M2_MIN = 200;
const PRICE_M2_MAX = 40000;

function validYears(years?: number[]): number[] {
  if (!years || years.length === 0) return DVF_YEARS;
  const valid = years.filter((y) => DVF_YEARS.includes(y));
  if (valid.length === 0) {
    throw new Error(`No DVF data for years [${years.join(", ")}]. Available: ${DVF_YEARS.join(", ")}.`);
  }
  return valid;
}

interface LocatedQuery {
  geo: GeocodeResult;
  /** Radius filtering only makes sense when the query resolves to a point. */
  isPoint: boolean;
}

async function locate(address: string): Promise<LocatedQuery> {
  const geo = await geocodeBest(address);
  if (!geo.citycode) throw new Error(`Could not resolve an INSEE code for "${address}".`);
  return { geo, isPoint: geo.type === "housenumber" || geo.type === "street" || geo.type === "locality" };
}

function saleView(m: Mutation) {
  return {
    date: m.date,
    nature: m.nature,
    price_eur: m.price,
    addresses: m.addresses,
    dwellings: m.dwellings,
    other_locals: m.otherLocals.length > 0 ? m.otherLocals : undefined,
    land_surface_m2: m.landSurface,
    price_per_m2: round(m.priceM2, 0),
  };
}

export async function geocodeAddress(args: { query: string; limit?: number }) {
  const results = await geocode(args.query, args.limit ?? 5);
  return { source: "Base Adresse Nationale (BAN)", results };
}

export async function propertySales(args: {
  address: string;
  radius_m?: number;
  years?: number[];
  type_local?: "Appartement" | "Maison";
  min_surface_m2?: number;
  max_surface_m2?: number;
  limit?: number;
}) {
  const years = validYears(args.years);
  const { geo, isPoint } = await locate(args.address);
  const radius = args.radius_m ?? 300;
  const limit = Math.min(args.limit ?? 30, 100);

  const rows = await fetchCommune(geo.citycode!, years);
  let mutations = groupMutations(rows).filter((m) => m.nature === "Vente");

  if (isPoint) {
    mutations = mutations.filter((m) => withinRadius(m, geo.lat, geo.lon, radius));
  }
  if (args.type_local) {
    mutations = mutations.filter((m) => m.dwellings.some((d) => d.type === args.type_local));
  }
  if (args.min_surface_m2 !== undefined || args.max_surface_m2 !== undefined) {
    mutations = mutations.filter((m) => {
      const s = m.dwellings.reduce((acc, d) => acc + (d.surface ?? 0), 0);
      if (s === 0) return false;
      if (args.min_surface_m2 !== undefined && s < args.min_surface_m2) return false;
      if (args.max_surface_m2 !== undefined && s > args.max_surface_m2) return false;
      return true;
    });
  }

  return {
    source: DVF_SOURCE,
    query: {
      resolved_address: geo.label,
      insee_code: geo.citycode,
      scope: isPoint ? `within ${radius} m of the address` : `whole commune (${geo.city})`,
      years,
    },
    total_matching_sales: mutations.length,
    sales: mutations.slice(0, limit).map(saleView),
    note:
      "price_per_m2 is only set when a deed covers exactly one dwelling; deeds bundling several units show the bundle price.",
  };
}

export async function pricePerM2(args: {
  address: string;
  type_local?: "Appartement" | "Maison";
  years?: number[];
  radius_m?: number;
}) {
  const years = validYears(args.years);
  const { geo, isPoint } = await locate(args.address);
  const radius = args.radius_m ?? 500;

  const rows = await fetchCommune(geo.citycode!, years);
  let mutations = groupMutations(rows).filter(
    (m) =>
      m.nature === "Vente" &&
      m.priceM2 !== null &&
      m.priceM2 >= PRICE_M2_MIN &&
      m.priceM2 <= PRICE_M2_MAX,
  );
  if (isPoint) mutations = mutations.filter((m) => withinRadius(m, geo.lat, geo.lon, radius));
  if (args.type_local) {
    mutations = mutations.filter((m) => m.dwellings[0]?.type === args.type_local);
  }

  const overall = mutations.map((m) => m.priceM2!);
  const byYear: Record<string, unknown> = {};
  for (const y of years) {
    const ofYear = mutations.filter((m) => m.date.startsWith(String(y))).map((m) => m.priceM2!);
    byYear[y] = {
      sales: ofYear.length,
      median_eur_m2: round(median(ofYear), 0),
      mean_eur_m2: round(mean(ofYear), 0),
    };
  }

  return {
    source: DVF_SOURCE,
    query: {
      resolved_address: geo.label,
      insee_code: geo.citycode,
      scope: isPoint ? `within ${radius} m of the address` : `whole commune (${geo.city})`,
      type_local: args.type_local ?? "Appartement + Maison",
      years,
    },
    sales_used: overall.length,
    median_eur_m2: round(median(overall), 0),
    mean_eur_m2: round(mean(overall), 0),
    p25_eur_m2: round(quantile(overall, 0.25), 0),
    p75_eur_m2: round(quantile(overall, 0.75), 0),
    by_year: byYear,
    note:
      "Computed from single-dwelling notarized sales only, outliers (<200 or >40 000 €/m²) excluded.",
  };
}

export async function dpeLookup(args: { address: string; limit?: number }) {
  const { geo } = await locate(args.address);
  const size = Math.min(args.limit ?? 10, 50);

  let exact = false;
  let res = geo.banId ? await dpeByBanId(geo.banId, size) : { total: 0, results: [] };
  if (res.total > 0) {
    exact = true;
  } else {
    const q = [geo.housenumber, geo.street].filter(Boolean).join(" ") || geo.label;
    res = await dpeByAddress(q, geo.citycode!, size);
  }

  return {
    source: "ADEME — DPE logements existants (open data)",
    query: { resolved_address: geo.label, ban_id: geo.banId, match: exact ? "exact BAN id" : "address search" },
    total_found: res.total,
    diagnostics: res.results,
    note: "etiquette_dpe = energy label (A best – G worst), etiquette_ges = greenhouse-gas label. conso_5_usages_par_m2_ep is primary energy in kWh/m²/year.",
  };
}

export async function naturalRisks(args: { address?: string; lat?: number; lon?: number }) {
  let lat = args.lat;
  let lon = args.lon;
  let resolved: string | null = null;
  if ((lat === undefined || lon === undefined) && args.address) {
    const { geo } = await locate(args.address);
    lat = geo.lat;
    lon = geo.lon;
    resolved = geo.label;
  }
  if (lat === undefined || lon === undefined) {
    throw new Error("Provide either an address or both lat and lon.");
  }
  const report = await riskReport(lat, lon);
  return {
    source: "Géorisques, Ministère de la Transition écologique",
    resolved_address: resolved ?? report.address,
    ...report,
  };
}

export async function communeInfo(args: { query: string }) {
  const q = args.query.trim();
  const isCode = /^\d[0-9AB]\d{3}$/i.test(q);
  const communes = isCode ? [await communeByCode(q.toUpperCase())] : await communesByName(q);
  if (communes.length === 0) throw new Error(`No commune found for "${q}".`);
  return {
    source: "geo.api.gouv.fr (INSEE)",
    communes: communes.map((c) => ({
      nom: c.nom,
      insee_code: c.code,
      postcodes: c.codesPostaux,
      departement: c.departement,
      region: c.region,
      population: c.population,
      surface_km2: c.surface !== undefined ? round(c.surface / 100, 1) : undefined,
      center: c.centre?.coordinates ? { lon: c.centre.coordinates[0], lat: c.centre.coordinates[1] } : undefined,
    })),
  };
}

export async function whatIsHere(args: { lat: number; lon: number }) {
  const results = await reverseGeocode(args.lat, args.lon);
  return { source: "Base Adresse Nationale (BAN)", results };
}
