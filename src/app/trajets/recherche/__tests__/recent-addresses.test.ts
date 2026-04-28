import { deduplicateRecentAddresses } from "../recent-addresses";

const run = (rows: { pickup_adresse: string }[], limit = 5) =>
  deduplicateRecentAddresses(rows, limit);

// RED: all these will fail until the function is created

const rows = [
  { pickup_adresse: "1 rue de la Paix, Metz" },
  { pickup_adresse: "2 avenue Foch, Metz" },
  { pickup_adresse: "1 rue de la Paix, Metz" }, // duplicate
  { pickup_adresse: "3 boulevard Poincaré, Metz" },
  { pickup_adresse: "4 rue Serpenoise, Metz" },
  { pickup_adresse: "5 place de la République, Metz" },
  { pickup_adresse: "6 rue des Clercs, Metz" },
];

if (typeof deduplicateRecentAddresses === "undefined") {
  throw new Error("deduplicateRecentAddresses is not defined");
}

const result = run(rows);

// Should return at most 5 items
console.assert(result.length === 5, `Expected 5 items, got ${result.length}`);

// Should preserve order
console.assert(result[0] === "1 rue de la Paix, Metz", `First item wrong: ${result[0]}`);
console.assert(result[1] === "2 avenue Foch, Metz", `Second item wrong: ${result[1]}`);

// No duplicates
const unique = new Set(result);
console.assert(unique.size === result.length, "Duplicates found");

// Empty input
const empty = run([]);
console.assert(empty.length === 0, "Expected empty array for empty input");

// Limit respected
const limited = run(rows, 3);
console.assert(limited.length === 3, `Expected 3 items with limit=3, got ${limited.length}`);

// Null/undefined safety
const withNull = run([{ pickup_adresse: "" }, { pickup_adresse: "valid address" }]);
console.assert(withNull.length === 1, `Expected 1 non-empty item, got ${withNull.length}`);
console.assert(withNull[0] === "valid address", `Expected 'valid address', got ${withNull[0]}`);

console.log("All assertions passed");
