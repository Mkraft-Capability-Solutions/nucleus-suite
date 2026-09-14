# Rule: Design Tokens & Theme System

## Zero Hardcoded Colors Policy

**ABSOLUTE RULE: No hex colors, rgb(), rgba(), or named colors anywhere in:**
- CSS module files (`.module.css`)
- Inline `style={{}}` JSX attributes
- Component files (`.js`, `.tsx`, `.ts`)

All visual properties must use the CSS custom property (design token) system.

## Complete Token Reference

### Surfaces & Backgrounds
```css
var(--bg)           /* page-level background */
var(--paper)        /* elevated surface (cards, panels) */
var(--card)         /* primary card background */
var(--card-2)       /* secondary card / input background */
var(--surface)      /* subtle surface */
var(--surface-2)    /* nested subtle surface */
```

### Typography
```css
var(--text)         /* primary body text */
var(--text-2)       /* secondary / muted text */
var(--text-3)       /* tertiary / placeholder text */
var(--hero-text)    /* large display / hero heading */
var(--hero-muted)   /* large display / subtitle */
```

### Primary Actions (Signal)
```css
var(--signal)       /* primary brand color (indigo/violet) */
var(--signal-ink)   /* darker signal for text on light wash */
var(--signal-wash)  /* light signal background tint */
var(--on-signal)    /* text/icon color on signal background */
```

### Status Colors
```css
var(--status-ok)         /* success green */
var(--status-ok-wash)    /* success background tint */
var(--flag)              /* error/danger red */
var(--flag-wash)         /* error background tint */
var(--pending)           /* warning amber */
var(--pending-wash)      /* warning background tint */
var(--info)              /* informational blue */
var(--info-wash)         /* informational background tint */
```

### Borders & Dividers
```css
var(--line)         /* standard border */
var(--line-soft)    /* subtle/light border */
var(--line-glow)    /* brand-colored glow border */
```

### Radii
```css
var(--r-data)       /* small — data cells, chips */
var(--r-control)    /* medium — inputs, buttons */
var(--r-card)       /* large — cards, panels */
var(--r-pill)       /* pill/capsule shape (999px equivalent) */
```

### Shadows
```css
var(--shadow-raise)   /* subtle card elevation */
var(--shadow-overlay) /* dropdown/modal overlay shadow */
```

## The 4 Themes

Tokens automatically adapt to the active theme. Components don't need conditional styling per theme.

| Theme | Key | Dark? |
|:---|:---|:---:|
| Pearl Violet | `pearl-violet` | No |
| Graphite Night | `graphite-night` | Yes |
| Slate Blue | `slate-blue` | No |
| Sage Teal | `sage-teal` | No |

## Common Pattern Examples

```css
/* ✅ Card component */
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  box-shadow: var(--shadow-raise);
  color: var(--text);
}

/* ✅ Primary button */
.primaryBtn {
  background: var(--signal);
  color: var(--on-signal);
  border-radius: var(--r-control);
}

/* ✅ Status badge — success */
.successBadge {
  background: var(--status-ok-wash);
  color: var(--status-ok);
  border-radius: var(--r-pill);
}

/* ❌ Never do this */
.card {
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #e2e8f0;
}
```

## Typography

Use the following Google Fonts via the global layout:
- **Primary:** `Inter` (UI text, labels, body)
- **Mono:** `JetBrains Mono` (code, IDs, technical values)

## Animations & Motion

- Prefer CSS transforms (`translateX`, `scale`, `rotate`) over layout properties
- Use `opacity` for fade effects
- Always support `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .animatedElement {
    animation: none;
    transition: none;
  }
}
```

- GPU-friendly properties only: `transform`, `opacity`, `filter`
- No `top`/`left`/`margin` animations (cause layout thrashing)
