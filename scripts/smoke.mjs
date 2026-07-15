// End-to-end smoke test against the live public APIs (no MCP transport).
// Run with: npm run smoke
import {
  geocodeAddress,
  propertySales,
  pricePerM2,
  dpeLookup,
  naturalRisks,
  communeInfo,
} from "../dist/handlers.js";

const ADDRESS = process.argv[2] ?? "12 rue de la République Lyon";
let failures = 0;

async function check(name, fn, assert) {
  try {
    const out = await fn();
    const problem = assert(out);
    if (problem) {
      failures++;
      console.log(`✗ ${name}: ${problem}`);
    } else {
      console.log(`✓ ${name}`);
    }
    return out;
  } catch (e) {
    failures++;
    console.log(`✗ ${name}: threw ${e.message}`);
    return null;
  }
}

console.log(`Smoke test address: ${ADDRESS}\n`);

const geo = await check("geocode_address", () => geocodeAddress({ query: ADDRESS }), (o) =>
  o.results.length > 0 ? null : "no geocode results",
);
if (geo) console.log(`  → ${geo.results[0].label} (insee ${geo.results[0].citycode})`);

const sales = await check(
  "property_sales",
  () => propertySales({ address: ADDRESS, radius_m: 400, limit: 5 }),
  (o) => (o.total_matching_sales > 0 ? null : "no sales found"),
);
if (sales) {
  console.log(`  → ${sales.total_matching_sales} sales, latest: ${JSON.stringify(sales.sales[0]?.price_eur)} € on ${sales.sales[0]?.date}`);
}

const stats = await check(
  "price_per_m2",
  () => pricePerM2({ address: ADDRESS, type_local: "Appartement" }),
  (o) => (o.sales_used > 0 && o.median_eur_m2 > 500 ? null : `implausible stats: ${JSON.stringify(o)}`),
);
if (stats) console.log(`  → median ${stats.median_eur_m2} €/m² over ${stats.sales_used} sales`);

const dpe = await check("dpe_lookup", () => dpeLookup({ address: ADDRESS, limit: 3 }), (o) =>
  o.total_found > 0 ? null : "no DPE found",
);
if (dpe) console.log(`  → ${dpe.total_found} DPE, first label: ${dpe.diagnostics[0]?.etiquette_dpe}`);

const risks = await check("natural_risks", () => naturalRisks({ address: ADDRESS }), (o) =>
  o.naturalRisks.length > 0 || o.technologicalRisks.length > 0 ? null : "empty risk report",
);
if (risks) console.log(`  → ${risks.naturalRisks.length} natural risks present`);

const commune = await check("commune_info", () => communeInfo({ query: "Lyon" }), (o) =>
  o.communes[0]?.population > 100000 ? null : "unexpected commune data",
);
if (commune) console.log(`  → ${commune.communes[0].nom}: ${commune.communes[0].population} inhabitants`);

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
