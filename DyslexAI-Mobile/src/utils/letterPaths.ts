/**
 * Normalized (0–1) outline points for tracing letters.
 * Used to draw the template and to score user strokes.
 * Each letter is a polyline; we draw with SVG and score by distance to these points.
 */
export type Point = { x: number; y: number };

function pathFromPoints(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  rest.forEach((p) => { d += ` L ${p.x} ${p.y}`; });
  return d;
}

/** Normalized points (0–1) for lowercase letters. Some letters are simplified. */
const LETTER_POINTS: Record<string, Point[]> = {
  a: [
    { x: 0.5, y: 0.95 }, { x: 0.5, y: 0.35 }, { x: 0.72, y: 0.15 }, { x: 0.85, y: 0.35 },
    { x: 0.85, y: 0.95 }, { x: 0.5, y: 0.55 }, { x: 0.8, y: 0.55 },
  ],
  b: [
    { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.9 }, { x: 0.35, y: 0.9 }, { x: 0.5, y: 0.75 },
    { x: 0.5, y: 0.5 }, { x: 0.35, y: 0.35 }, { x: 0.2, y: 0.5 }, { x: 0.2, y: 0.35 },
    { x: 0.35, y: 0.1 }, { x: 0.5, y: 0.25 }, { x: 0.5, y: 0.5 },
  ],
  c: [
    { x: 0.8, y: 0.25 }, { x: 0.55, y: 0.1 }, { x: 0.25, y: 0.2 }, { x: 0.1, y: 0.5 },
    { x: 0.25, y: 0.8 }, { x: 0.55, y: 0.9 }, { x: 0.8, y: 0.75 },
  ],
  d: [
    { x: 0.2, y: 0.1 }, { x: 0.2, y: 0.9 }, { x: 0.45, y: 0.9 }, { x: 0.7, y: 0.7 },
    { x: 0.8, y: 0.5 }, { x: 0.7, y: 0.3 }, { x: 0.45, y: 0.1 }, { x: 0.2, y: 0.1 },
  ],
  e: [
    { x: 0.75, y: 0.2 }, { x: 0.25, y: 0.2 }, { x: 0.25, y: 0.8 }, { x: 0.75, y: 0.8 },
    { x: 0.25, y: 0.5 }, { x: 0.65, y: 0.5 },
  ],
  o: [
    { x: 0.5, y: 0.15 }, { x: 0.8, y: 0.35 }, { x: 0.85, y: 0.5 }, { x: 0.75, y: 0.75 },
    { x: 0.5, y: 0.9 }, { x: 0.25, y: 0.75 }, { x: 0.15, y: 0.5 }, { x: 0.25, y: 0.35 }, { x: 0.5, y: 0.15 },
  ],
  s: [
    { x: 0.7, y: 0.2 }, { x: 0.4, y: 0.15 }, { x: 0.2, y: 0.35 }, { x: 0.35, y: 0.5 },
    { x: 0.65, y: 0.5 }, { x: 0.8, y: 0.65 }, { x: 0.6, y: 0.9 }, { x: 0.25, y: 0.85 },
  ],
  t: [
    { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.9 },
  ],
  // Additional letters – simplified single stroke
  f: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }, { x: 0.5, y: 0.45 }, { x: 0.25, y: 0.45 }, { x: 0.25, y: 0.35 }],
  h: [{ x: 0.2, y: 0.1 }, { x: 0.2, y: 0.9 }, { x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, { x: 0.8, y: 0.9 }, { x: 0.8, y: 0.1 }],
  i: [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.85 }, { x: 0.5, y: 0.95 }],
  l: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.9 }],
  n: [{ x: 0.2, y: 0.9 }, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.9 }, { x: 0.8, y: 0.2 }],
  p: [{ x: 0.2, y: 0.9 }, { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.65, y: 0.45 }, { x: 0.5, y: 0.7 }, { x: 0.2, y: 0.7 }],
  r: [{ x: 0.2, y: 0.9 }, { x: 0.2, y: 0.2 }, { x: 0.55, y: 0.2 }, { x: 0.7, y: 0.5 }],
  u: [{ x: 0.2, y: 0.2 }, { x: 0.2, y: 0.8 }, { x: 0.5, y: 0.95 }, { x: 0.8, y: 0.8 }, { x: 0.8, y: 0.2 }],
  v: [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.9 }, { x: 0.8, y: 0.2 }],
  w: [{ x: 0.15, y: 0.2 }, { x: 0.35, y: 0.9 }, { x: 0.5, y: 0.5 }, { x: 0.65, y: 0.9 }, { x: 0.85, y: 0.2 }],
  x: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.9 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.2 }, { x: 0.2, y: 0.9 }],
  y: [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.55 }, { x: 0.2, y: 0.9 }, { x: 0.5, y: 0.55 }, { x: 0.8, y: 0.9 }],
  z: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.2, y: 0.9 }, { x: 0.8, y: 0.9 }],
  j: [{ x: 0.6, y: 0.2 }, { x: 0.6, y: 0.75 }, { x: 0.4, y: 0.9 }, { x: 0.2, y: 0.85 }],
  g: [{ x: 0.5, y: 0.2 }, { x: 0.8, y: 0.35 }, { x: 0.85, y: 0.6 }, { x: 0.6, y: 0.85 }, { x: 0.25, y: 0.8 }, { x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }],
  k: [{ x: 0.2, y: 0.1 }, { x: 0.2, y: 0.9 }, { x: 0.2, y: 0.5 }, { x: 0.75, y: 0.25 }, { x: 0.2, y: 0.5 }, { x: 0.75, y: 0.75 }],
  m: [{ x: 0.15, y: 0.9 }, { x: 0.15, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.85, y: 0.2 }, { x: 0.85, y: 0.9 }],
  q: [{ x: 0.5, y: 0.15 }, { x: 0.8, y: 0.35 }, { x: 0.85, y: 0.6 }, { x: 0.65, y: 0.85 }, { x: 0.35, y: 0.8 }, { x: 0.15, y: 0.5 }, { x: 0.5, y: 0.15 }, { x: 0.65, y: 0.65 }, { x: 0.85, y: 0.9 }],
};

/** Returns SVG path "d" for a letter (lowercase). Null if no path defined. */
export function getLetterPathD(letter: string): string | null {
  const key = letter.toLowerCase();
  const points = LETTER_POINTS[key];
  if (!points || points.length < 2) return null;
  return pathFromPoints(points);
}

/** Returns normalized (0–1) reference points for a letter. Null if no path defined. */
export function getLetterPathPoints(letter: string): Point[] | null {
  const key = letter.toLowerCase();
  return LETTER_POINTS[key] ?? null;
}

/** Whether we have a path for this letter (for scoring). */
export function hasLetterPath(letter: string): boolean {
  return getLetterPathPoints(letter.toLowerCase()) != null;
}

/** For words: get path data for each character. Returns array of path d strings and point arrays (null for unknown letters). */
export function getWordPaths(word: string): Array<{ d: string | null; points: Point[] | null }> {
  return word.split('').map((char) => {
    const points = getLetterPathPoints(char);
    const d = points && points.length >= 2 ? pathFromPoints(points) : null;
    return { d, points };
  });
}
