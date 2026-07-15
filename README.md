# mcp-immo-france

[![CI](https://github.com/zeddparis/mcp-immo-france/actions/workflows/ci.yml/badge.svg)](https://github.com/zeddparis/mcp-immo-france/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/mcp-immo-france)](https://www.npmjs.com/package/mcp-immo-france)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

**French real-estate intelligence for AI assistants.** Give Claude (or any MCP client) a French address and it can pull the **actual notarized sale prices** around it, compute **price per m²**, check the **energy rating (DPE)**, list **natural & technological risks**, and describe the commune — all from official French open data, with **zero API keys**.

> 🇫🇷 Serveur MCP pour l'immobilier français : prix de vente réels (DVF), prix au m², DPE, risques naturels (Géorisques) et données communales pour n'importe quelle adresse — sans aucune clé API. [Section française ↓](#-en-français)

## Why

Real-estate portals show *asking* prices. The French state publishes what properties **actually sold for** (DVF, from notarized deeds), every energy diagnostic ever filed (ADEME), and the official risk report for every parcel (Géorisques) — but these datasets are scattered, keyed differently, and unpleasant to join by hand.

`mcp-immo-france` wires them together behind seven MCP tools so a conversation like this just works:

> **You:** I'm visiting a flat at 12 rue de la République in Lyon, 60 m² listed at 450 000 €. Is that overpriced? Anything I should worry about?
>
> **Claude:** *(calls `price_per_m2`, `property_sales`, `dpe_lookup`, `natural_risks`)*
> Around that address, 328 flats sold since 2021 at a **median of 6 153 €/m²**, so a 60 m² flat would typically trade near **369 000 €** — the asking price is ~22 % above the local median. Recent comparable sales include… The building's filed DPE ratings are D… The address sits in a zone with recorded flood and clay-shrinkage risk, so check the insurance history…

Everything is sourced, dated, and computed from single-dwelling notarized sales only.

## Quickstart

Requires Node.js ≥ 18. No account, no API key, nothing to configure.

**Claude Code**

```bash
claude mcp add immo-france -- npx -y mcp-immo-france
```

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "immo-france": {
      "command": "npx",
      "args": ["-y", "mcp-immo-france"]
    }
  }
}
```

**Any other MCP client** — run `npx -y mcp-immo-france` over stdio.

## Tools

| Tool | What it does | Source |
|---|---|---|
| `property_sales` | Actual notarized sales (price, date, surface, rooms) around an address or across a commune, 2021–2025 | DVF (DGFiP / Etalab) |
| `price_per_m2` | Median / mean / quartiles €/m² + per-year evolution, computed from single-dwelling sales | DVF (DGFiP / Etalab) |
| `dpe_lookup` | Energy performance certificates filed for an address (labels A–G, GES, surface, year built) | ADEME |
| `natural_risks` | Official risk report: flood, clay shrink-swell, radon, earthquake, industrial sites… | Géorisques |
| `commune_info` | Population, postcodes, département, région, surface, center of any commune | geo.api.gouv.fr (INSEE) |
| `geocode_address` | Normalize any French address to coordinates + INSEE code + BAN id | Base Adresse Nationale |
| `reverse_geocode` | Nearest address for GPS coordinates | Base Adresse Nationale |

### Example prompts

- *« Combien se sont vendus les appartements rue Oberkampf à Paris depuis 2022 ? »*
- *« Quel est le prix au m² des maisons à Bordeaux, et son évolution depuis 2021 ? »*
- *« Ce bien au 8 rue de la Paix est-il en zone inondable ? Quel est son DPE ? »*
- *"Compare price per m² between Lyon 3e and Villeurbanne for flats."*

## Data sources & honesty notes

| Dataset | Publisher | Coverage |
|---|---|---|
| [DVF géolocalisées](https://files.data.gouv.fr/geo-dvf/) | DGFiP / Etalab | Sales 2021–2025. **Not covered:** Alsace-Moselle (Bas-Rhin, Haut-Rhin, Moselle) and Mayotte |
| [DPE logements existants](https://data.ademe.fr/datasets/dpe03existant) | ADEME | All diagnostics filed since July 2021 |
| [Géorisques](https://www.georisques.gouv.fr/) | Ministère de la Transition écologique | Whole territory |
| [Base Adresse Nationale](https://adresse.data.gouv.fr/) | IGN / DINUM | Whole territory |
| [Découpage administratif](https://geo.api.gouv.fr/) | INSEE / Etalab | Whole territory |

Methodology guardrails built in:

- **€/m² is only computed when a deed covers exactly one dwelling.** DVF prices are per *mutation* (deed), and a deed bundling three flats and a shop has no meaningful per-m² figure. Multi-unit deeds are still listed, flagged, with the bundle price.
- Statistical outliers (< 200 or > 40 000 €/m²) are excluded from aggregates.
- Every response names its source and the scope actually used (radius, years, commune).
- Commune CSVs are cached in memory (bounded LRU) — repeated questions about the same area don't re-download anything.

This tool surfaces public data; it is **not** financial, legal or investment advice.

## Development

```bash
npm install
npm run build     # tsc
npm test          # unit tests (no network)
npm run smoke     # end-to-end against the live public APIs
npm run smoke -- "5 avenue Anatole France Paris"   # any address you like
```

The codebase is small and dependency-light on purpose: the MCP SDK, `zod`, and the Node standard library. PRs welcome — see the roadmap.

## Roadmap

- [ ] Rent estimates (carte des loyers, Ministère du Logement)
- [ ] New-build DPE dataset (`dpe02neuf`)
- [ ] Cadastral parcel lookup
- [ ] Streamable HTTP transport for remote deployment

## 🇫🇷 En français

Serveur [MCP](https://modelcontextprotocol.io) qui donne à Claude (ou tout client MCP) l'accès aux **vraies ventes immobilières** (DVF — actes notariés publiés par la DGFiP), au **prix au m²** calculé proprement, aux **DPE** déposés à l'ADEME, au **rapport de risques Géorisques** et aux données INSEE de n'importe quelle commune. Aucune clé API, aucune inscription : `npx -y mcp-immo-france` et c'est en place.

Exemples : *« Prix au m² autour du 10 rue de la Paix ? »*, *« Historique des ventes de maisons à Arcachon depuis 2021 ? »*, *« Cette adresse est-elle en zone argileuse ou inondable ? »*

## License

[MIT](LICENSE)
