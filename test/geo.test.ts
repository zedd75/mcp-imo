import { describe, expect, it } from "vitest";
import { departementFromInsee, haversineMeters, parentCommuneCode } from "../src/util/geo.js";

describe("geo utils", () => {
  it("maps PLM arrondissements to their parent commune", () => {
    expect(parentCommuneCode("75102")).toBe("75056"); // Paris 2e
    expect(parentCommuneCode("69383")).toBe("69123"); // Lyon 3e
    expect(parentCommuneCode("13208")).toBe("13055"); // Marseille 8e
    expect(parentCommuneCode("33063")).toBe("33063"); // Bordeaux unchanged
  });

  it("extracts département codes, including DOM and Corsica", () => {
    expect(departementFromInsee("75102")).toBe("75");
    expect(departementFromInsee("97411")).toBe("974");
    expect(departementFromInsee("2A004")).toBe("2A");
  });

  it("haversine distance is plausible", () => {
    // Paris -> Lyon is about 392 km as the crow flies.
    const d = haversineMeters(48.8566, 2.3522, 45.764, 4.8357);
    expect(d).toBeGreaterThan(380000);
    expect(d).toBeLessThan(400000);
  });
});
