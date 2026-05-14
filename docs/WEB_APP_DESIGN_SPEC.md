# DyslexAI – Web App Design Spec

Use this spec so the web app matches the DyslexAI mobile app’s **colors, theme, typography, spacing, and UI patterns**. Same features and same look.

---

## 1. Design tokens (copy into your app)

### Colors

| Token | Hex | Usage |
|-------|-----|--------|
| **Primary** | `#308ce8` | Buttons, links, icons, progress, highlights |
| **Primary light** | `#5ba3ef` | Hover / lighter primary areas |
| **Primary dark** | `#1a6bb8` | Pressed / darker primary |
| **Background** | `#f5f5f5` | Page background |
| **Surface** | `#ffffff` | Cards, inputs, modals |
| **Surface elevated** | `#fafafa` | Raised cards, list items |
| **Text** | `#1a1a1a` | Primary text |
| **Text secondary** | `#5c5c5c` | Descriptions, labels |
| **Text muted** | `#8a8a8a` | Hints, placeholders |
| **Border** | `#e0e0e0` | Input borders, dividers |
| **Divider** | `#eeeeee` | Subtle separators |
| **Success** | `#4caf50` | Success states, “on” indicators |
| **Warning** | `#ff9800` | Warnings |
| **Error** | `#f44336` | Errors, destructive actions |
| **Info** | `#308ce8` | Same as primary |
| **Highlight** | `#308ce8` | Progress, selection |
| **Corrected** | `#fff59d` | Yellow highlight for corrections (e.g. underline) |

### CSS variables (paste into your global CSS or design system)

```css
:root {
  /* Primary */
  --color-primary: #308ce8;
  --color-primary-light: #5ba3ef;
  --color-primary-dark: #1a6bb8;

  /* Background */
  --color-background: #f5f5f5;
  --color-surface: #ffffff;
  --color-surface-elevated: #fafafa;

  /* Text */
  --color-text: #1a1a1a;
  --color-text-secondary: #5c5c5c;
  --color-text-muted: #8a8a8a;

  /* Borders */
  --color-border: #e0e0e0;
  --color-divider: #eeeeee;

  /* Semantic */
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;
  --color-corrected: #fff59d;

  /* Spacing (px) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}
```

### Typography

- **Font family:** [Lexend](https://fonts.google.com/specimen/Lexend) (dyslexia-friendly).  
  Use: `font-family: 'Lexend', sans-serif;` and load from Google Fonts.
- **Weights:** 400 (regular), 500 (medium), 600 (semiBold), 700 (bold).
- **Typical sizes:**  
  - Titles: 24–32px, bold (700).  
  - Section headings: 16–18px, semiBold (600).  
  - Body: 14–16px, regular (400).  
  - Small / labels: 12–13px, regular or medium.  
  - Muted text: same sizes with `color: var(--color-text-muted)` or `var(--color-text-secondary)`.

### Spacing scale (px)

| Token | Value |
|-------|--------|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |

Use these for padding and margins so layout matches the app.

### Border radius

| Token | Value |
|-------|--------|
| `sm` | 8px |
| `md` | 12px |
| `lg` | 16px |
| `full` | 9999px (pills/circles) |

---

## 2. UI patterns (match these in the web app)

- **Page background:** `#f5f5f5` (background).
- **Cards / panels:** White (`#ffffff`) or elevated (`#fafafa`), with `border-radius: 12px` (md), padding ~16–24px.
- **Primary buttons:** Background `#308ce8`, white text, semiBold, rounded (e.g. 12px). No heavy shadows.
- **Secondary / text buttons:** Transparent or surface background, primary color for text.
- **Inputs:** White background, border `#e0e0e0`, focus with primary color.
- **Icons:** Use [Material Icons](https://fonts.google.com/icons) (same as mobile). Primary color for main actions, `textMuted` for secondary.
- **Dividers / lists:** `#eeeeee` or `#e0e0e0`.
- **Corrections in text:** Yellow highlight `#fff59d` (e.g. background or underline).
- **Status:** Green for success, red for error, orange for warning, using the semantic colors above.

---

## 3. Screens / features to mirror

The web app should offer the same flows and features:

| Screen / flow | Purpose |
|----------------|--------|
| **Landing** | Logo (e.g. menu-book icon), “DyslexAI”, tagline, “Get Started” / “I already have an account”. |
| **Signup / Login** | Auth forms; same primary/secondary button style. |
| **Dashboard** | User greeting, backend status (scan, exercise, DB), quick tools (Scan, Exercises, Library), stats (stars, streak), recent progress. |
| **Upload** | Document scan entry: camera / upload, then send to scan backend. |
| **Scan results** | Show raw vs corrected text, correction highlights (`#fff59d`), optional error regions. |
| **Learning exercises** | List of modules (e.g. Word typing, Sentence typing, Tracing); progress per module; same card style. |
| **Practice** | Per-exercise UI: prompt, input, submit, result with score (green/orange/red), feedback, “Next” / “Generate more”. |
| **Library** | Saved scans/documents list; same card and list styling. |
| **Settings** | Menu: About, Help, Privacy, Terms, Logout; same typography and spacing. |
| **About / Help / Privacy / Terms** | Scrollable content; title 24px bold, sections 16px semiBold, body 15px secondary color. |

Navigation and layout can be tabs/sidebar for web, but **colors, type, spacing, and components** should follow this spec.

---

## 4. Quick reference: theme object (JS/TS)

If your friend uses a theme object (e.g. in React or Tailwind config), they can mirror the mobile app’s theme like this:

```ts
export const colors = {
  primary: '#308ce8',
  primaryLight: '#5ba3ef',
  primaryDark: '#1a6bb8',
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#fafafa',
  text: '#1a1a1a',
  textSecondary: '#5c5c5c',
  textMuted: '#8a8a8a',
  border: '#e0e0e0',
  divider: '#eeeeee',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#308ce8',
  highlight: '#308ce8',
  corrected: '#fff59d',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const borderRadius = { sm: 8, md: 12, lg: 16, full: 9999 } as const;
export const fontFamily = "'Lexend', sans-serif";
// Weights: 400 regular, 500 medium, 600 semiBold, 700 bold
```

---

## 5. What to share with your friend

1. **This file:** `WEB_APP_DESIGN_SPEC.md` (or a copy in the web repo).
2. **Optional:** The mobile theme source so they can align exactly:
   - `DyslexAI-Mobile/src/theme/colors.ts`
   - `DyslexAI-Mobile/src/theme/index.ts`
3. **Optional:** One or two representative screens (e.g. `LandingScreen.tsx`, `StudentDashboardScreen.tsx`) for layout and component structure.

With this spec, they can implement the same colors, theme, typography, spacing, and UI patterns in the web app (e.g. with Tailwind, CSS variables, or a design system) and keep the experience consistent with the mobile app.
