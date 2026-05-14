import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { View, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import type { Point } from '../utils/letterPaths';
import { getLetterPathD, getLetterPathPoints, getWordPaths } from '../utils/letterPaths';
import { colors, spacing } from '../theme';

const CANVAS_SIZE = 280;
const STROKE_WIDTH = 14;
const TEMPLATE_STROKE = colors.textMuted;
const USER_STROKE = colors.primary;
const DASH_ARRAY = '8 6';
const SCORE_THRESHOLD = 0.3;
const MIN_POINTS_FOR_SCORE = 15;
const RESAMPLE_SIZE = 72;

export type TracingScore = {
  score: number;
  stroke_errors: Array<{ letter: string; accuracy: number }>;
};

export type TracingCanvasRef = {
  getScore: () => TracingScore;
  clear: () => void;
  hasStrokes: () => boolean;
};

type Props = {
  expected: string;
  onStrokeChange?: (hasStrokes: boolean) => void;
};

function scalePathD(d: string, scaleX: number, scaleY: number, offsetX: number, offsetY: number): string {
  return d.replace(/([ML])\s*([\d.]+)\s+([\d.]+)/g, (_, cmd, x, y) => {
    const nx = parseFloat(x) * scaleX + offsetX;
    const ny = parseFloat(y) * scaleY + offsetY;
    return `${cmd} ${nx} ${ny}`;
  });
}

export const TracingCanvas = forwardRef<TracingCanvasRef, Props>(function TracingCanvas(
  { expected, onStrokeChange },
  ref
) {
  const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
  const pathLength = (pts: Point[]): number => {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += distance(pts[i - 1], pts[i]);
    return total;
  };
  const pointToSegmentDistance = (p: Point, a: Point, b: Point): number => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = p.x - a.x;
    const wy = p.y - a.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return distance(p, a);
    const c2 = vx * vx + vy * vy;
    if (c2 <= 0) return distance(p, a);
    if (c2 <= c1) return distance(p, b);
    const t = c1 / c2;
    return distance(p, { x: a.x + t * vx, y: a.y + t * vy });
  };
  const nearestDistanceToPolyline = (p: Point, polyline: Point[]): number => {
    if (polyline.length < 2) return 1;
    let best = 1;
    for (let i = 1; i < polyline.length; i++) {
      const d = pointToSegmentDistance(p, polyline[i - 1], polyline[i]);
      if (d < best) best = d;
    }
    return best;
  };
  const densify = (pts: Point[], step = 0.015): Point[] => {
    if (pts.length < 2) return pts;
    const out: Point[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const segLen = distance(a, b);
      const pointsToAdd = Math.max(1, Math.floor(segLen / step));
      for (let j = 1; j <= pointsToAdd; j++) {
        const t = j / pointsToAdd;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return out;
  };
  const resampleByArcLength = (pts: Point[], count: number): Point[] => {
    if (pts.length < 2) return pts;
    const polyline = densify(pts);
    const total = pathLength(polyline);
    if (total === 0) return polyline.slice(0, Math.min(polyline.length, count));
    const interval = total / Math.max(1, count - 1);
    const out: Point[] = [polyline[0]];
    let target = interval;
    let walked = 0;
    for (let i = 1; i < polyline.length && out.length < count - 1; i++) {
      const a = polyline[i - 1];
      const b = polyline[i];
      const segLen = distance(a, b);
      while (walked + segLen >= target && out.length < count - 1) {
        const t = (target - walked) / segLen;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        target += interval;
      }
      walked += segLen;
    }
    out.push(polyline[polyline.length - 1]);
    return out;
  };
  const normalizePoints = (pts: Point[]): Point[] => {
    if (pts.length === 0) return pts;
    const meanX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const meanY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    const centered = pts.map((p) => ({ x: p.x - meanX, y: p.y - meanY }));
    const maxRange = Math.max(
      0.0001,
      Math.max(...centered.map((p) => p.x)) - Math.min(...centered.map((p) => p.x)),
      Math.max(...centered.map((p) => p.y)) - Math.min(...centered.map((p) => p.y))
    );
    return centered.map((p) => ({ x: p.x / maxRange, y: p.y / maxRange }));
  };
  const oneWayMeanDistance = (from: Point[], toPolyline: Point[]): number => {
    if (from.length === 0 || toPolyline.length < 2) return 1;
    return from.reduce((sum, p) => sum + nearestDistanceToPolyline(p, toPolyline), 0) / from.length;
  };
  const [paths, setPaths] = useState<Array<{ d: string | null; points: Point[] | null }>>([]);
  const [userPoints, setUserPoints] = useState<Point[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const pathsInit = useRef<string>('');

  const expectedClean = String(expected ?? '').trim().toLowerCase().replace(/[^a-z]/g, '');
  const isWord = expectedClean.length > 1;

  useEffect(() => {
    if (expectedClean && pathsInit.current !== expectedClean) {
      pathsInit.current = expectedClean;
      if (isWord) {
        setPaths(getWordPaths(expectedClean));
      } else {
        const d = getLetterPathD(expectedClean);
        const points = getLetterPathPoints(expectedClean);
        setPaths(d && points ? [{ d, points }] : []);
      }
      setUserPoints([]);
      setCurrentStroke([]);
    }
  }, [expectedClean, isWord]);

  const allRefPoints: Point[] = (() => {
    if (paths.length === 0) return [];
    if (!isWord) return paths[0].points ?? [];
    const out: Point[] = [];
    const n = paths.length;
    paths.forEach((p, i) => {
      const pts = p.points ?? [];
      pts.forEach((pt) => {
        out.push({ x: (i / n) + (pt.x / n), y: pt.y });
      });
    });
    return out;
  })();
  const hasTemplate = paths.some((p) => p.d != null);

  const toNormalized = useCallback(
    (x: number, y: number): Point => ({
      x: Math.max(0, Math.min(1, x / CANVAS_SIZE)),
      y: Math.max(0, Math.min(1, y / CANVAS_SIZE)),
    }),
    []
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX ?? 0;
        const y = evt.nativeEvent.locationY ?? 0;
        const p = toNormalized(x, y);
        setCurrentStroke([p]);
        setUserPoints((prev) => [...prev, p]);
        onStrokeChange?.(true);
      },
      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX ?? 0;
        const y = evt.nativeEvent.locationY ?? 0;
        const p = toNormalized(x, y);
        setCurrentStroke((prev) => [...prev, p]);
        setUserPoints((prev) => [...prev, p]);
      },
      onPanResponderRelease: () => {
        setCurrentStroke([]);
      },
    })
  ).current;

  const allUserPoints = [...userPoints, ...currentStroke];

  // Interpolate extra points when two touches are far apart so the curve has more definition
  const INTERPOLATE_THRESHOLD = 0.04;
  const interpolatePoints = (points: Point[]): Point[] => {
    if (points.length < 2) return points;
    const out: Point[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dist > INTERPOLATE_THRESHOLD) {
        const steps = Math.min(4, Math.max(2, Math.ceil(dist / INTERPOLATE_THRESHOLD)));
        for (let k = 1; k < steps; k++) {
          const t = k / steps;
          out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
      }
      out.push(b);
    }
    return out;
  };

  // Build smooth path: quadratic Bezier through points so strokes look curved, not jagged straight segments
  const buildSmoothPathD = (points: Point[]): string => {
    const pts = interpolatePoints(points);
    if (pts.length < 2) return '';
    const s = CANVAS_SIZE;
    const [first, ...rest] = pts;
    let d = `M ${first.x * s} ${first.y * s}`;
    if (rest.length === 0) return d;
    if (rest.length === 1) {
      const p = rest[0];
      return `${d} L ${p.x * s} ${p.y * s}`;
    }
    // Q (control x) (control y) (end x) (end y) — use each point as control for segment to next
    for (let i = 0; i < rest.length - 1; i++) {
      const ctrl = rest[i];
      const end = rest[i + 1];
      d += ` Q ${ctrl.x * s} ${ctrl.y * s} ${end.x * s} ${end.y * s}`;
    }
    return d;
  };
  const userPathD = buildSmoothPathD(allUserPoints);

  const getScore = useCallback((): TracingScore => {
    const all = [...userPoints, ...currentStroke];
    if (all.length < MIN_POINTS_FOR_SCORE) {
      return {
        score: 0.5,
        stroke_errors: expectedClean.split('').map((letter) => ({ letter, accuracy: 0.5 })),
      };
    }
    if (allRefPoints.length === 0) {
      return { score: 0.85, stroke_errors: [] };
    }
    const userCurve = normalizePoints(resampleByArcLength(all, RESAMPLE_SIZE));
    const refCurve = normalizePoints(resampleByArcLength(allRefPoints, RESAMPLE_SIZE));
    const meanDist = (oneWayMeanDistance(userCurve, refCurve) + oneWayMeanDistance(refCurve, userCurve)) / 2;
    const score = Math.max(0, Math.min(1, 1 - meanDist / SCORE_THRESHOLD));
    const stroke_errors = expectedClean.split('').map((letter) => ({ letter, accuracy: score }));
    return { score, stroke_errors };
  }, [userPoints, currentStroke, allRefPoints.length, expectedClean]);

  const clear = useCallback(() => {
    setUserPoints([]);
    setCurrentStroke([]);
    onStrokeChange?.(false);
  }, [onStrokeChange]);

  useImperativeHandle(
    ref,
    () => ({
      getScore,
      clear,
      hasStrokes: () => userPoints.length > 0 || currentStroke.length > 0,
    }),
    [getScore, clear, userPoints.length, currentStroke.length]
  );

  const n = Math.max(0, paths.length);
  const letterW = n > 0 && isWord ? CANVAS_SIZE / n : CANVAS_SIZE;

  if (!expectedClean) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.canvas, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}>
          <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
            <SvgText x={CANVAS_SIZE / 2} y={CANVAS_SIZE * 0.5} textAnchor="middle" fontSize={14} fill={colors.textMuted}>
              Draw the letter or word shown above
            </SvgText>
          </Svg>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.canvas, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}
        {...panResponder.panHandlers}
      >
        <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
          {paths.map((p, i) => {
            if (!p.d) return null;
            const offsetX = isWord ? i * letterW : 0;
            const scaleX = isWord ? letterW : CANVAS_SIZE;
            const scaleY = CANVAS_SIZE;
            const scaledD = scalePathD(p.d, scaleX, scaleY, offsetX, 0);
            return (
              <Path
                key={i}
                d={scaledD}
                fill="none"
                stroke={TEMPLATE_STROKE}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={DASH_ARRAY}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
          {userPathD ? (
            <Path
              d={userPathD}
              fill="none"
              stroke={USER_STROKE}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {!hasTemplate && expectedClean ? (
            <SvgText
              x={CANVAS_SIZE / 2}
              y={CANVAS_SIZE * 0.6}
              textAnchor="middle"
              fontSize={120}
              fill="none"
              stroke={TEMPLATE_STROKE}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={DASH_ARRAY}
            >
              {expectedClean.length > 1 ? expectedClean : expectedClean.toUpperCase()}
            </SvgText>
          ) : null}
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: spacing.md },
  canvas: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
