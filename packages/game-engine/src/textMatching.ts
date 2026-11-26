/**
 * Normaliza texto libre para comparación tolerante a acentos, mayúsculas,
 * plurales simples y puntuación. Usado para evaluar "¿Qué viste?" contra
 * el concepto original y contra la respuesta del jugador anterior.
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos/diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ") // quita puntuación
    .replace(/\s+/g, " ")
    .trim()
    .replace(/s\b/g, ""); // heurística simple de singularización de plurales
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const above = prev[j] ?? i; // eliminación
      const left = curr[j - 1] ?? i; // inserción
      const diagonal = prev[j - 1] ?? j; // sustitución
      curr[j] = Math.min(above + 1, left + 1, diagonal + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? j;
  }
  return prev[n] ?? 0;
}

/** Similitud 0..1 basada en distancia de edición normalizada por la longitud mayor. */
export function textSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na.length === 0 && nb.length === 0) return 1;
  if (na.length === 0 || nb.length === 0) return 0;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

export const SIMILARITY_THRESHOLD = 0.8;
const MIN_SIGNIFICANT_TOKEN_LENGTH = 3;

/**
 * Determina si `guess` coincide razonablemente con `target` (concepto original
 * o adivinanza anterior). Considera:
 *  - coincidencia exacta normalizada,
 *  - inclusión significativa de un token (p.ej. "gato" dentro de "gato negro"),
 *  - similitud de edición por encima del umbral (errores de tipeo, lemas).
 */
export function matchesConcept(guess: string, target: string): boolean {
  const g = normalizeText(guess);
  const t = normalizeText(target);

  if (g.length === 0 || t.length === 0) return false;
  if (g === t) return true;

  const longEnough = (s: string) => s.length >= MIN_SIGNIFICANT_TOKEN_LENGTH;
  if (longEnough(g) && longEnough(t) && (t.includes(g) || g.includes(t))) {
    return true;
  }

  return textSimilarity(g, t) >= SIMILARITY_THRESHOLD;
}
