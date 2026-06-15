import { describe, it, expect } from "vitest";
import {
  nextOccurrences,
  nextOccurrencesMulti,
  occurrencesFromRange,
  formatJours,
  formatProgramme,
  toLocalDateString,
} from "./dates";

// ─── nextOccurrences (legacy, rétrocompat) ───────────────────────────────────

describe("nextOccurrences (legacy)", () => {
  it("returns the correct count of dates", () => {
    const result = nextOccurrences(0, 3); // dimanche
    expect(result).toHaveLength(3);
  });

  it("all returned dates fall on the correct weekday", () => {
    const result = nextOccurrences(3, 4); // mercredi (DOW 3)
    for (const d of result) {
      expect(d.getDay()).toBe(3);
    }
  });

  it("defaults to 4 occurrences", () => {
    expect(nextOccurrences(1)).toHaveLength(4);
  });
});

// ─── nextOccurrencesMulti ─────────────────────────────────────────────────────

describe("nextOccurrencesMulti", () => {
  it("returns dates matching any of the given weekdays", () => {
    // dimanche=0, mercredi=3
    const result = nextOccurrencesMulti([0, 3], 8);
    for (const d of result) {
      expect([0, 3]).toContain(d.getDay());
    }
    expect(result).toHaveLength(8);
  });

  it("returns results in ascending order", () => {
    const result = nextOccurrencesMulti([5, 0, 3], 6);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].getTime()).toBeGreaterThan(result[i - 1].getTime());
    }
  });

  it("handles a single-day array same as nextOccurrences", () => {
    const multi = nextOccurrencesMulti([2], 4);
    const single = nextOccurrences(2, 4);
    for (let i = 0; i < 4; i++) {
      expect(toLocalDateString(multi[i])).toBe(toLocalDateString(single[i]));
    }
  });

  it("deduplicates: single day requested N times still gives unique dates", () => {
    const result = nextOccurrencesMulti([1, 1], 4);
    const strings = result.map(toLocalDateString);
    const unique = new Set(strings);
    expect(unique.size).toBe(strings.length);
  });

  it("returns empty array for empty jours list", () => {
    const result = nextOccurrencesMulti([], 4);
    expect(result).toHaveLength(0);
  });

  it("defaults to 4 occurrences", () => {
    expect(nextOccurrencesMulti([0])).toHaveLength(4);
  });
});

// ─── occurrencesFromRange ────────────────────────────────────────────────────

describe("occurrencesFromRange", () => {
  it("returns all dates in the range [debut, fin] inclusive", () => {
    const result = occurrencesFromRange("2030-01-06", "2030-01-10");
    const strings = result.map(toLocalDateString);
    expect(strings).toEqual([
      "2030-01-06",
      "2030-01-07",
      "2030-01-08",
      "2030-01-09",
      "2030-01-10",
    ]);
  });

  it("returns a single date when debut === fin", () => {
    const result = occurrencesFromRange("2030-03-15", "2030-03-15");
    expect(result).toHaveLength(1);
    expect(toLocalDateString(result[0])).toBe("2030-03-15");
  });

  it("returns empty array when fin < debut", () => {
    const result = occurrencesFromRange("2030-03-15", "2030-03-10");
    expect(result).toHaveLength(0);
  });

  it("excludes past dates (before today)", () => {
    // date bien dans le passé
    const result = occurrencesFromRange("2020-01-01", "2020-01-07");
    expect(result).toHaveLength(0);
  });

  it("includes today if in range", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = toLocalDateString(today);
    // plage qui inclut uniquement aujourd'hui
    const result = occurrencesFromRange(todayStr, todayStr);
    expect(result).toHaveLength(1);
  });

  it("handles a future multi-month range", () => {
    const result = occurrencesFromRange("2030-06-01", "2030-07-31");
    expect(result).toHaveLength(61); // juin 30 + juillet 31
  });
});

// ─── formatJours ─────────────────────────────────────────────────────────────

describe("formatJours", () => {
  it("formats a single weekday", () => {
    expect(formatJours([0])).toBe("Dim.");
  });

  it("formats two weekdays", () => {
    expect(formatJours([0, 3])).toBe("Dim., Mer.");
  });

  it("formats all days", () => {
    expect(formatJours([0, 1, 2, 3, 4, 5, 6])).toBe(
      "Dim., Lun., Mar., Mer., Jeu., Ven., Sam.",
    );
  });

  it("sorts weekdays before formatting regardless of input order", () => {
    // input non-trié : sam, dim, mer → doit sortir Dim., Mer., Sam.
    expect(formatJours([6, 0, 3])).toBe("Dim., Mer., Sam.");
  });

  it("returns empty string for empty array", () => {
    expect(formatJours([])).toBe("");
  });
});

// ─── formatProgramme ─────────────────────────────────────────────────────────

describe("formatProgramme", () => {
  it("formats a recurring programme with one day", () => {
    expect(formatProgramme({ jours_semaine: [0], date_debut: null, date_fin: null })).toBe(
      "Dim.",
    );
  });

  it("formats a recurring programme with multiple days", () => {
    expect(
      formatProgramme({ jours_semaine: [0, 3], date_debut: null, date_fin: null }),
    ).toBe("Dim., Mer.");
  });

  it("formats an event programme with debut and fin in same month", () => {
    expect(
      formatProgramme({
        jours_semaine: [],
        date_debut: "2030-06-01",
        date_fin: "2030-06-21",
      }),
    ).toBe("1–21 juin 2030");
  });

  it("formats an event programme spanning two months", () => {
    expect(
      formatProgramme({
        jours_semaine: [],
        date_debut: "2030-06-28",
        date_fin: "2030-07-05",
      }),
    ).toBe("28 juin – 5 juil. 2030");
  });

  it("formats an event on a single day", () => {
    expect(
      formatProgramme({
        jours_semaine: [],
        date_debut: "2030-09-15",
        date_fin: "2030-09-15",
      }),
    ).toBe("15 sept. 2030");
  });

  it("falls back to legacy jour_semaine when jours_semaine empty and no dates", () => {
    expect(
      formatProgramme({
        jours_semaine: [],
        date_debut: null,
        date_fin: null,
        jour_semaine: 3,
      }),
    ).toBe("Mer.");
  });

  it("returns empty string when no data available", () => {
    expect(
      formatProgramme({ jours_semaine: [], date_debut: null, date_fin: null }),
    ).toBe("");
  });
});
