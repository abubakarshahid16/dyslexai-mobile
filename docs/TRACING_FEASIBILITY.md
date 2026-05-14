# Finger-tracing exercises – feasibility

This document summarizes how feasible it is to add **finger-tracing** exercises to the DyslexAI mobile app (user traces letters or words with their finger on the screen) and what implementation would involve.

---

## Status: **implemented**

Tracing is now implemented in the app: **Letter & Word Tracing** appears on the Learning screen; users trace with their finger on an SVG canvas; score is computed from path distance and submitted to the backend. See `DyslexAI-Mobile/src/components/TracingCanvas.tsx` and `src/utils/letterPaths.ts`.

---

## Summary: **very feasible**

Finger-tracing in a React Native / Expo app is **very feasible**. The stack you already use (Expo, React Native) supports the needed primitives: touch handling, SVG or canvas drawing, and optional gesture libraries. The **backend already supports tracing** (exercise type `tracing`, endpoint `POST /sessions/{id}/submit-tracing`); the main work is the **in-app tracing UI** and a **scoring method** for how well the user followed the template.

---

## What already exists

| Layer | Status |
|-------|--------|
| **Backend** | Tracing is implemented: exercises can have `type: "tracing"` with `content` like "Trace this letter: a" or "Trace this word: cat", and `POST /sessions/{id}/submit-tracing` accepts `trace_score`, `duration_seconds`, and optional `stroke_errors`. |
| **API (mobile)** | `submitTracing(sessionId, traceScore, durationSeconds, strokeErrors)` exists in `api/exercises.ts`. |
| **Practice screen** | `PracticeScreen` has a branch for `isTracing` and calls `submitTracing`, but the **UI is a placeholder**: it uses a fixed `traceScorePct` (e.g. 80%) instead of a real trace. |
| **Learning screen** | Tracing is **disabled** in the learning modules list (only Word Typing and Sentence Builder are shown) and in backend “next exercise” selection. |

So: **backend and API are ready**. The gap is a **trace-on-screen UI** and **scoring logic**.

---

## What you need to build

### 1. Tracing UI (drawing with finger)

- **Option A – react-native-svg (recommended)**  
  - Use `react-native-svg` (Expo-compatible) to draw:
    - A **template path**: the letter or word outline (e.g. from an SVG path or font outline).
    - The **user’s path**: points collected from touch/mouse events (e.g. `PanResponder` or `react-native-gesture-handler`).
  - User sees the template (e.g. dashed or light gray); they trace over it; you record their stroke(s) and compare to the template.

- **Option B – Canvas / Skia**  
  - Use something like `@shopify/react-native-skia` for a canvas and draw the template + user stroke. More control, slightly more setup.

- **Option C – Overlay on image**  
  - Render the letter/word as an image (or SVG), then capture touch coordinates on top. Simpler for “did they stay on the line?” checks.

**Recommendation:** Start with **react-native-svg** and a **PanResponder** (or gesture handler) to record stroke points. No new backend work.

### 2. Letter/word templates

- **Letters:** Use SVG paths for each letter (lowercase and optionally uppercase). You can:
  - Export paths from a font (e.g. with a tool or from a “tracing font” asset), or
  - Use a small set of hand-drawn or standard tracing SVGs (e.g. one path per letter).
- **Words:** Concatenate or arrange letter paths, or use a single path per word for short words.

This is mostly asset/design work; no backend change.

### 3. Scoring (how well they traced)

The backend expects a **single `trace_score` (0.0–1.0)** and optionally **per-letter/stroke accuracy** in `stroke_errors`. You can:

- **Simple:** Derive one score from “average distance of user points to the template path” (e.g. mean distance to nearest point on the path, then map to 0–1).
- **Stricter:** Percentage of user path that lies “on” the template (within a distance threshold), or segment the template into segments and score each.
- **Per-stroke:** If you send `stroke_errors`, compute a score per letter and send those; backend can store them for analytics.

All of this is **client-side logic**; backend API already accepts the result.

### 4. Re-enable tracing in the app and backend

- **Learning screen:** Add a third module, e.g. “Letter / Word tracing”, that navigates to Practice with `exerciseType: 'tracing'`.
- **Backend:** In `exercises.py`, remove or relax the filter that **excludes** `type == "tracing"` from `get_next` (and from any other “next exercise” logic) so tracing exercises can be served when requested.
- **Generate tracing exercises:** Backend already has (or can have) logic to generate tracing exercises (e.g. “Trace this letter: X”, “Trace this word: Y”); ensure `GET /exercises/next?student_id=...&type=tracing` returns them.

---

## Effort estimate (rough)

| Task | Effort |
|------|--------|
| SVG/gesture tracing screen (one letter, then one word) | 2–4 days |
| Letter SVG paths (e.g. a–z, maybe A–Z) | 1–2 days (or use existing assets) |
| Scoring (distance-to-path → 0–1 + optional stroke_errors) | 1–2 days |
| Wire into Practice flow and re-enable tracing in backend/learning | 0.5–1 day |

**Total:** on the order of **1–2 weeks** for a **polished** first version (refined paths, device testing, scoring tweaks). A **minimal working version** (simplified paths, one scoring method, wired to existing backend) can be done in a single session—that’s what’s implemented now.

---

## Dependencies

- **react-native-svg** – Expo supports it; install with `npx expo install react-native-svg` if not already present.
- **PanResponder** (built-in) or **react-native-gesture-handler** (already common in RN apps) for touch handling.

No backend or new service dependencies.

---

## Conclusion

Adding finger-tracing for letters and words in the mobile app is **very feasible**: the backend and API are ready; you need a tracing screen (SVG + touch), letter/word templates, client-side scoring, and to re-enable tracing in the learning flow and in backend exercise selection. Estimated effort is about **1–2 weeks** for a solid first version.
