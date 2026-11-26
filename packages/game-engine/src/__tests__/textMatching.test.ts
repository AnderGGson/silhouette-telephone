import { describe, expect, it } from "vitest";
import { matchesConcept, normalizeText, textSimilarity } from "../textMatching";

describe("normalizeText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeText("Camión Rápido")).toBe("camion rapido");
  });

  it("removes punctuation and collapses whitespace", () => {
    expect(normalizeText("  ¡Un,  gato!!  ")).toBe("un gato");
  });

  it("applies a simple plural heuristic", () => {
    expect(normalizeText("gatos")).toBe("gato");
    expect(normalizeText("gato")).toBe("gato");
  });
});

describe("textSimilarity", () => {
  it("returns 1 for identical normalized strings", () => {
    expect(textSimilarity("Gato", "gato")).toBe(1);
  });

  it("returns a high score for a minor typo", () => {
    expect(textSimilarity("elefante", "elefant")).toBeGreaterThan(0.8);
  });

  it("returns a low score for unrelated words", () => {
    expect(textSimilarity("elefante", "bicicleta")).toBeLessThan(0.5);
  });
});

describe("matchesConcept", () => {
  it("matches exact normalized text", () => {
    expect(matchesConcept("Gato Negro", "gato negro")).toBe(true);
  });

  it("matches via significant substring inclusion", () => {
    expect(matchesConcept("gato", "un gato negro durmiendo")).toBe(true);
  });

  it("matches minor typos via similarity threshold", () => {
    expect(matchesConcept("dinosaurio", "dinosaurio")).toBe(true);
    expect(matchesConcept("dinosaurio", "dinosauro")).toBe(true);
  });

  it("does not match unrelated concepts", () => {
    expect(matchesConcept("perro", "submarino amarillo")).toBe(false);
  });

  it("does not match empty guesses", () => {
    expect(matchesConcept("", "gato")).toBe(false);
    expect(matchesConcept("(sin respuesta)", "gato")).toBe(false);
  });
});
