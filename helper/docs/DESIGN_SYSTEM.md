# Nucleus HRMS Design System

> **Status:** current-state extraction from the implemented `mkraft-hrms` interface (not a proposed redesign).  
> **Source of truth:** [`src/app/globals.css`](../src/app/globals.css), [`src/components/ui`](../src/components/ui), and [`src/components/hrms`](../src/components/hrms).  
> **Default experience:** dark mode. Light mode is supported and uses the same semantic token names.

## 1. Design intent

Nucleus is an operational HR workspace, not a consumer app. The interface should make consequential people decisions feel legible, safe, and calm.

1. **Clarity before decoration.** The page answers “what needs attention, what is changing, and what can I do?” before adding visual flourish.
2. **Trust is visible.** Security, auditability, tenant context, data freshness, permissions, and controlled workflows are stated in the interface rather than hidden behind implementation details.
3. **Dense, but breathable.** Data-dense dashboards use compact type and controls, while cards, gutters, and section boundaries create reliable scan paths.
4. **One signal color, semantic exceptions.** The `--signal` blue (`#2563EB` light / `#38BDF8` dark) represents primary action and active focus; `success` green carries healthy/complete state. Warning, destructive, information, and AI colors identify meaning; they must not be used as decoration.
5. **Progressive disclosure.** The narrow left dock expands on hover; large module navigation lives in a launcher; the right rail is contextual and can be dismissed; mobile moves secondary navigation into a sheet.
6. **Human-led intelligence.** AI appears as a scoped, violet-tinted assistant that explains signals. It never visually competes with primary business actions.
7. **Motion confirms changes.** Small fades, short vertical offsets, width fills, and overlays communicate entry, state, and hierarchy. Motion must be optional for users who prefer reduced motion.
8. **Responsive by prioritisation.** Preserve the primary work surface first; hide or move secondary controls at smaller widths instead of squeezing everything into a smaller desktop layout.

## 2. Technology and implementation stack

| Concern | Implementation | Role in the visual system |
| --- | --- | --- |
| App shell | Next.js 16 + React 19 | App Router application and server/client UI boundaries |
| Styling | Tailwind CSS v4 + CSS custom properties | Utility-first implementation backed by semantic design tokens |
| Component baseline | shadcn (`base-nova`) | Directory, token integration, and component conventions |
| Accessible primitives | `@base-ui/react` | Buttons, dialogs/sheets, inputs, menus, tabs, tooltips, and progress semantics |
| Variants | `class-variance-authority` | Reusable button and badge variants |
| Icons | `lucide-react` | The single default icon family; outline icons are normally 14–20 px |
| Motion | `motion/react` | Entrance, menu, overlay, layout, and data-transition motion |
| Scroll animation | GSAP + ScrollTrigger | Available in `AnimatedContent`; currently an optional utility rather than a shell convention |
| Data visualisation | Recharts | Dashboard charts, tooltips, grids, progress and comparative data |
| Utility merge | `cn` | Conditional Tailwind class composition |

Use the shared primitives before introducing a new dependency or a parallel component. `AuroraBackground`, `AnimatedContent`, `DecryptedText`, and `ShinyBadge` are available visual utilities, but are not part of the main HRMS work-surface language today; use them only in deliberately expressive, non-operational contexts.

## 3. Brand and visual personality

### Brand mark

The mark is a 36–44 px rounded-square `--signal` tile with a bold **N**. It appears with the Montserrat product name and an understated Lato descriptor:

```text
[ N ]  NUCLEUS HRMS
       WORKFORCE OS
```

- Use `rounded-lg`, not a fully circular or sharp-cornered mark.
- Use a small, confident mark in navigation; do not introduce a separate logo style for each module.
- Treat the name as a product wordmark, not as display advertising.

### Surface character

- Dark mode is charcoal/slate, not pure black: it reduces glare in long operational sessions.
- Cards are lightly lifted with one-pixel borders and a soft blue-black shadow.
- Corners are mostly 8 px (`rounded-lg`); 12 px (`rounded-xl`) identifies richer cards, forms, or grouped content; pills are reserved for statuses and the floating AI action.
- The visual language is quiet and technical: thin lines, tabular numbers, short all-caps metadata, and disciplined muted text.
- Avoid gradients in the main workspace. The heatmap is a data encoding, not a decorative gradient. Aurora effects are not part of the default product shell.

## 4. Foundations

### 4.1 Theme architecture

The app stores the user choice under `mkraft-theme`, adds `.dark` or `.light` to `<html>`, and initializes **dark** when no saved light preference is present. Components must use semantic classes/tokens (`bg-card`, `text-muted-foreground`, `border-border`) instead of selecting a mode directly.

### 4.2 Color tokens

#### Light theme

| Token | Value | Intended use |
| --- | --- | --- |
| `background` | `#f4f7f8` | Page canvas |
| `foreground` | `#17232b` | Primary text |
| `card` / `popover` | `#ffffff` | Raised content and menus |
| `primary` | `#2f6f68` | Primary action, active state, key positive/brand signal |
| `primary-foreground` | `#ffffff` | Text/icons on primary |
| `secondary` / `muted` | `#f8fafb` | Quiet fills, inactive controls, inset areas |
| `secondary-foreground` | `#4e5d68` | Secondary text |
| `muted-foreground` | `#6e7c86` | Supporting copy, metadata, placeholders |
| `accent` | `#e6f0ee` | Selected/hovered contextual navigation |
| `accent-foreground` | `#275e58` | Text on accent |
| `border` | `#d8e0e4` | Structural edges and dividers |
| `input` | `#bbc8ce` | Input border/fill reference |
| `ring` | `#315f7d` | Keyboard focus |
| `destructive` | `#a65353` | Errors, destructive actions |
| `success` | `#3f745f` | Successful/healthy state |
| `info` | `#496d8c` | Informational state |
| `warning` | `#916f36` | Needs attention or risk |
| `ai` | `#6e6685` | Mira/AI-only signal |

#### Dark theme

| Token | Value | Intended use |
| --- | --- | --- |
| `background` | `#0f1519` | Main canvas |
| `foreground` | `#e7ecef` | Primary text |
| `card` | `#171f24` | Raised work-surface |
| `popover` / `secondary` | `#1d272d` | Menus and quiet controls |
| `primary` | `#78aaa3` | Brand/action signal |
| `primary-foreground` | `#101918` | Text/icons on primary |
| `muted` | `#171f24` | Quiet fill |
| `muted-foreground` | `#8d9aa3` | Supporting text |
| `accent` | `#203330` | Active/selected contextual area |
| `accent-foreground` | `#e7ecef` | Text on accent |
| `border` | `#303d45` | Structural edges |
| `input` | `#46555f` | Input reference |
| `ring` | `#78a3bf` | Keyboard focus |
| `destructive` | `#a65353` | Error/danger signal |
| `success` | `#679a80` | Positive signal |
| `info` | `#6f91ad` | Informational signal |
| `warning` | `#b08c50` | Attention signal |
| `ai` | `#918aa5` | Mira/AI signal |

#### Charts

Use these in sequence for categorical series. They have deliberate contrast in both themes and should not be replaced by arbitrary module colors.

| Token | Light | Dark |
| --- | --- | --- |
| `chart-1` | `#527d78` | `#78aaa3` |
| `chart-2` | `#5c7894` | `#7892ab` |
| `chart-3` | `#71806b` | `#899682` |
| `chart-4` | `#94784e` | `#aa8c63` |
| `chart-5` | `#776e84` | `#91899d` |

### 4.3 Typography

| Role | Family | Weights used | Implementation and use |
| --- | --- | --- | --- |
| Interface/body | Lato | 400, 700 | `font-sans`; readable body, labels, help text |
| Headings/actions | Montserrat | variable via Google font | `font-heading`; `h1–h3`, buttons, navigation, titles, wordmark |
| Operational metadata | IBM Plex Mono via `font-mono` token | 400, 500, 600 | Tiny timestamps, IDs, counts, compact table/chart labels; pair with `tabular-nums` for values |

**Type scale in use**

| Job | Typical classes | Notes |
| --- | --- | --- |
| Hero/login statement | `text-4xl sm:text-5xl`, `leading-[1.12]` | Reserved for the login proposition |
| Page title | `text-2xl sm:text-[28px]`, `leading-9`, `font-semibold` | One decisive title per page |
| Major section | `text-[15px] sm:text-lg`, `font-semibold` | `SectionHeading` and widget titles |
| Card title/body | `text-sm`, `text-xs`, 12–21 px line-height | Default work-surface reading level |
| Dense labels/metadata | `text-[11px]`, `text-[12px]`, `font-mono` when factual | The dominant dashboard-density scale |
| Numeric metric | `text-[28px]`, `text-2xl` to `text-4xl`, `tabular-nums` | Values must not jump in width while loading/updating |

Rules:

- Headings use Montserrat, `font-weight: 600`, and `letter-spacing: -0.018em` globally.
- Body copy should be direct, short, and factual. Use muted text for explanation, not lower opacity on primary text.
- Use `uppercase` plus modest tracking (`0.12–0.16em`) only for compact metadata such as widget periods or column-type labels.
- Do not use more than one display-scale heading on an operational page.

### 4.4 Spacing, density, and geometry

The practical spacing rhythm is 4 px based, with 8/12/16/20/24 px used most often.

| Context | Typical implementation |
| --- | --- |
| Micro gap | `gap-1` / `gap-1.5` (4–6 px) |
| Inline control gap | `gap-2` / `gap-2.5` / `gap-3` (8–12 px) |
| Card inner padding | `p-4` (16 px) for widgets, `p-5` (20 px) for normal surfaces |
| Main content padding | `p-4 sm:p-5 lg:p-6` (16/20/24 px) |
| Section separation | `mt-3` to `mt-6`; borders are used where a stronger boundary is needed |
| Primary controls | `h-10` (40 px); auth and emphasis buttons/fields use `h-11` (44 px) |
| Small controls | `h-6`, `h-7`, `h-8`, or `h-9` only when supporting another task |
| Icon controls | normally `size-9` or `size-10`; icon glyphs 14–20 px |
| Standard radius | `--radius: 0.5rem`; generally `rounded-lg` (8 px) |
| Rich cards/forms | `rounded-xl` (12 px) |
| Pills/avatars | `rounded-full`; status pills may use `rounded-md` |

There is intentional variation in radius: the base UI layer prefers `rounded-lg`, while richer task cards, onboarding views, and form surfaces often use `rounded-xl`. Do not introduce `rounded-2xl` as the default; it is a special treatment for feature/capability panels and visual grouping.

### 4.5 Borders, elevation, and effects

- Default structural edge: `border border-border` at one device pixel.
- Standard card: `nucleus-panel` = `border`, `bg-card`, and `0 6px 18px rgba(15,23,42,.08)`.
- Inset/quiet group: `nucleus-inset` = `border` + `bg-secondary`; use for sub-panels, not for every list item.
- High-context overlay: popovers use `rounded-[10px]`, a border, and `0 20px 50px rgba(15,23,42,.18)`.
- Hover treatment is mostly a border or fill shift (`hover:border-primary/35`, `hover:bg-secondary`), not large scale or shadow changes.
- Decorative glow is limited to sparse accents, such as a blurred primary circle in a hero/feature panel.

## 5. Layout and navigation

### Application shell

```text
┌──────────┬───────────────────────────────┬─────────────────┐
│ Hovering │ Sticky global header           │                 │
│ 64 → 240 │ search · modules · quick add   │                 │
│ px left  ├───────────────────────────────┤ Contextual      │
│ dock     │ Main work surface              │ intelligence    │
│          │ 16 / 20 / 24 px page padding   │ rail, 260 px    │
│          │ responsive content grid        │ xl and up       │
└──────────┴───────────────────────────────┴─────────────────┘
```

- **Left dock:** fixed, 64 px wide; expands to 240 px on hover at desktop. It holds top-level domains, not every destination. Active items use sidebar accent fill + primary text.
- **Header:** sticky; 56 px at base, 60 px at `sm`, 64 px at `lg`. Search, module launcher, dashboard switcher, quick add, theme, notifications, user menu, and contextual-rail toggle live here.
- **Main work surface:** fluid and minimum-width safe. Dashboard grids collapse from 12 columns into 6 or 1 column layouts based on `sm`/`lg` breakpoints.
- **Right rail:** 260 px, visible only at `xl` and up. It is contextual “Intelligence & work,” not another primary navigation tree. On smaller screens it opens in a right sheet limited to 320 px or 90 vw.
- **Floating AI entry:** a fixed violet rounded pill at bottom-right. It is always available but visually secondary to the page’s primary action.

### Responsive rules

| Range | Design behavior |
| --- | --- |
| Mobile/base | Main content becomes single-column. Hide global search, dashboard selector, wordy account details, and desktop dock labels. Use module and right-rail sheets. |
| `sm` | Increase content padding; display selected multi-column cards and quick-add action. |
| `md` | Surface global search and preserve key workspace controls. |
| `lg` | Desktop content padding and module action; reveal header density progressively. |
| `xl` | Show dashboard selector and persistent contextual right rail. |

Never depend on hover alone for a critical action. The left dock’s expansion is a desktop affordance; all destinations remain icon-identifiable and are available from the module launcher.

## 6. Component language

### Shared UI primitives

| Component | Visual contract | States/notes |
| --- | --- | --- |
| `Button` | Montserrat 13 px semibold; `rounded-lg`; 40 px default height | `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; sizes `xs`, `sm`, `default`, `lg`, and icon variants |
| `Input` | Compact 32 px shared primitive; 8 px radius; token border | Higher-stakes forms often use a local 40–44 px `rounded-xl` field pattern; retain focus and invalid states |
| `Card` | Token card background; 12 px radius; standard 16 px spacing | Use its header/content/footer slots when a generic card is enough; use `Surface` for HRMS work panels |
| `Badge` | 20 px high rounded pill; small status/supporting label | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link` |
| `Tabs` | 32 px segmented default or line variant | Active tab gains background/shadow or a 2 px foreground underline |
| `Table` | Horizontal overflow allowed; 40 px header; 8 px cells | Divider rows; muted hover/selected background; avoid wrapping key operational values |
| `Progress` | 4 px rounded rail with primary fill | Pair with a label/value; values use tabular numerals |
| `Sheet` | Token popover, light 10% black blurred backdrop, 200 ms slide/fade | Mobile navigation and modular secondary tasks; close button is an icon button with screen-reader label |
| `DropdownMenu`, `Tooltip`, `Separator`, `Avatar` | Token-driven supporting primitives | Follow Base UI semantics and shared radius/spacing |

### HRMS page primitives

| Pattern | Use it for | Contract |
| --- | --- | --- |
| `PageIntro` | Every top-level workspace page | Thin bottom divider; `--signal` 2 px eyebrow rule; `text-2xl` page title; max-width 2xl supporting copy; action aligns to desktop baseline |
| `SectionHeading` | Within-page grouping | 15–18 px Montserrat title, muted description, optional right action |
| `Surface` | Default HRMS panel | `nucleus-panel`, `rounded-lg`, 20 px padding; lower padding to 16 px for dashboard widgets |
| `MetricCard` | One key outcome | Icon tile, directional delta chip, tabular count-up value, compact label; enter with a 10 px / 450 ms rise |
| `StatusPill` | State classification | `success`, `warning`, `danger`, `info`, `violet`, `neutral`; subtle 10% fill + 25% border; optional dot |
| `AvatarMark` | Human/tenant initials | 32/40/56 px, rounded rectangle, mono bold initials, 1 px ring; use supplied color only as a 15% tint |
| `AiLabel` | AI provenance/scope | Violet icon + label, 10% fill, 30% border; copy should identify the AI feature rather than make unqualified claims |
| `WidgetHeader` | Dashboard panels | Plain-language title plus tiny uppercase mono period/source metadata |

### Content and data patterns

- **Dashboard grid:** section cards use a 12-column grid with 12 px gaps (`gap-3`). Lead chart is typically `lg:col-span-8`; supporting chart is `lg:col-span-4`; lower modules combine 4/5/7/8 spans.
- **Metric row:** four compact `MetricCard`s at desktop; collapse according to the page grid. Present a clear loading or unknown state rather than inventing a zero.
- **Analytics:** use muted dashed horizontal grids, no heavy axes, 11–12 px labels, token chart colors, and bordered card tooltips. Area charts use a 24% → 0% fill. Bars have `radius={[0,8,8,0]}`.
- **Tables and approval queues:** compact rows; 11–12 px factual content; muted sublines; status pill in its own narrow column; row action is a small outlined icon button.
- **Empty/loading states:** centre a single helpful sentence in the component footprint. Use “Loading…” or a factual explanation such as “No joining records yet”; do not show fictional examples as live data.
- **Forms:** group by workflow, separate larger groups with a border top, put labels above inputs, show required asterisk in destructive color, and put help/errors immediately below the field. Primary submit is full width inside focused forms.
- **Dialogs:** compact, bordered, `rounded-xl` content with a clear heading and labelled close control. Data-entry forms use `aria-invalid`, `aria-describedby`, and focus the first invalid field after validation.

## 7. Interaction and motion

### State treatment

| State | Treatment |
| --- | --- |
| Default | Quiet border, card or secondary fill, readable foreground |
| Hover | Modest secondary fill and/or primary-tinted border; text may move from muted to foreground |
| Selected/active | Accent fill with foreground/primary text, or primary action fill when the item is a direct action |
| Focus-visible | 2–3 px token ring with offset; never remove keyboard focus |
| Disabled | No pointer events when appropriate; `opacity-50` or `opacity-60`; preserve label legibility |
| Invalid | Destructive border and a destructive focus ring; field-specific message directly underneath |
| Loading | Action label becomes a short progress phrase with spinner, or component retains its footprint with a factual loading message |
| Success/error | Rounded contextual notice using 5–10% semantic fill and 25–30% semantic border |

### Motion contract

- Default CSS color transitions are **150–200 ms**.
- Menus and popovers enter/exit at **4 px vertical offset** plus opacity; they do not zoom dramatically.
- Cards/metrics commonly enter at **8–10 px** vertical offset and **200–450 ms** duration.
- Values count up over **1.2 s** only where that movement helps reveal a dashboard refresh.
- Data fills animate around **500 ms**; heatmap cells stagger at **8 ms** per cell.
- Use `MotionConfig reducedMotion="user"` for app-shell motion and honor the global `prefers-reduced-motion` rule, which effectively removes animation and smooth scrolling.
- Avoid looping animation in operational surfaces. `ShinyBadge` has a shimmer capability, but it is an exception and should be reserved for a genuinely live/attention-worthy signal.

## 8. Accessibility and content rules

### Accessibility baseline

- Base elements receive `focus-visible` ring and offset styles globally.
- Inputs, buttons, links, text areas, and selects are keyboard-focusable with a visible state.
- Charts have meaningful `aria-label`s; buttons, icon-only controls, password visibility, and close actions have explicit labels.
- Overlays use Base UI dialog/sheet semantics, titles, descriptions, and a screen-reader-only fallback where needed.
- Errors use `role="alert"`; loading/success use `role="status"`; live messaging uses `aria-live="polite"`.
- Progress indicators expose `role="progressbar"` and min/max/current value.
- Use semantic source and freshness language (for example, “LIVE DIRECTORY” or “last refreshed”) when data is operationally meaningful.

### Content tone

- Write in calm, precise operational language: “Approvals waiting on you,” “No finalized run,” “All clear.”
- State source and confidence. AI insight copy explicitly says it is drawn from live approvals/anomalies and “never modelled or guessed.”
- Use short labels, sentence-case user-facing actions, and uppercase only for compact system metadata.
- Avoid motivational marketing language inside the workspace. The login page can be warmer and more aspirational; the product pages should be direct and evidence-led.

## 9. Implementation rules

### Do

- Use CSS variables and semantic Tailwind classes: `bg-card`, `text-muted-foreground`, `border-border`, `text-primary`.
- Start new HRMS panels with `Surface`, page headings with `PageIntro`, and section headings with `SectionHeading`.
- Use `Button`, `StatusPill`, `AiLabel`, and `AvatarMark` where their contract matches.
- Use `font-heading` for controls/titles, `font-sans` for readable copy, and `font-mono tabular-nums` for compact IDs/numbers.
- Keep dashboard source/period labels with the visualisation they qualify.
- Test every new page at base/mobile, `sm`, `lg`, and `xl` before merging.
- Validate focus order, visible focus, dialogs, errors, and reduced-motion behavior with each interaction-heavy feature.

### Do not

- Hardcode a new brand hex in a work-surface component when a semantic token exists.
- Use the signal blue or success green for arbitrary decoration; reserve them for brand/action/healthy states.
- Put a vivid AI treatment around unrelated functionality.
- Add excessive shadows, gradients, glass effects, large radii, or scale-on-hover to ordinary operational panels.
- Make tables lose their horizontal scroll behavior or wrap critical identifiers into unreadable rows.
- Replace meaningful empty/loading states with sample data that could be mistaken for production information.
- Convey state by color alone; retain a label, icon, dot, trend glyph, or text explanation.

## 10. Current design-system audit

The implementation has a strong semantic foundation, but it is not yet perfectly token-pure. The figures below are a source scan of `src`, not a visual QA score.

| Area | Current state | Interpretation |
| --- | --- | --- |
| Token theme | Complete light/dark semantic palette | Strong foundation; semantic classes are predominant |
| Typography | Two family system, defined heading/body use | Strong and consistent |
| Shared primitives | 11 UI primitives plus HRMS page primitives | Good reusable coverage |
| Radius use | `rounded-xl` 165, `rounded-lg` 125, `rounded-full` 34 occurrences | The project favors friendly, contained cards; document the hierarchy rather than normalize blindly |
| Type density | `text-xs` 309, `text-[11px]` 178, `text-sm` 85 occurrences | Intentionally compact enterprise density; protect legibility in new work |
| Control heights | `h-10` 134, `h-8` 26, `h-11` 14 occurrences | 40 px is the primary operational-control standard |
| Accessibility | Global focus, Base UI primitives, labels/roles, reduced motion | Good baseline; maintain it in bespoke forms and data widgets |

### Exceptions to consolidate over time

1. ~~**Right-rail local colors.**~~ **Closed** in the v2.0.0 migration. The rail now uses `--rail`, `--rail-text`, `--rail-active` and `--rail-line`. The rail is dark chrome in *both* themes, so only the `--rail-*` foregrounds may be painted on it — never `--foreground`, which is dark ink in light mode.
2. ~~**One-off semantic colors.**~~ **Closed** in the v2.0.0 migration. No Tailwind palette class or colour literal remains in `src` outside `src/components/ui`. Categorical chart distinction uses `--chart-1` … `--chart-5`, which are theme-aware.
3. **Component-scale form variation.** Shared `Input` is 32 px, while common bespoke workflow fields are 40–44 px with `rounded-xl`. This is appropriate for form intent, but should be formalised as explicit `compact` and `field` input sizes instead of repeatedly authored classes.
4. **Legacy/experimental decorative utilities.** Aurora, decrypt text, scroll animation, and shimmer are available but mostly unused in the core product. Keep them out of routine dashboard and workflow work unless a purposeful, reduced-motion-safe use case is approved.

## 10a. Nucleus UI v2.0.0 token system and the contrast guard

`src/app/globals.css` is the single source of colour. It is layered:

1. **Design-system tokens** — `--ink`, `--paper`, `--surface`, `--signal`, `--status-ok`,
   `--flag`, `--pending`, `--info-accent`, `--agent`, `--line*`, `--rail*`, plus spacing,
   radii, elevation and motion tokens. Defined once per theme.
2. **shadcn/Tailwind semantic aliases** — `--background`, `--card`, `--primary`,
   `--muted-foreground`, `--border` … are *aliases over layer 1*. Components keep using
   `bg-card` / `text-muted-foreground` / `border-border` and inherit the palette for free.

Dark mode is carried by **both** `.dark` (the Tailwind variant) and `[data-theme="dark"]`
(the design-system selector). `theme-provider.tsx` and the pre-hydration script in
`layout.tsx` set both, so either may be relied on.

### The contrast rule

**No dark text on a dark surface, no light text on a light surface, in either theme.**
Every foreground token is paired to the surface it is painted on. This is enforced by
`src/lib/theme-contrast.test.ts`, which parses the real token values out of `globals.css`,
follows `var()` aliases, composites translucent surfaces over their backdrop, and asserts
WCAG ratios: 4.5:1 for body text, 3:1 for UI text and solid fills. A token edit that breaks
a pairing fails the suite.

Two rules that are easy to get wrong:

- A `/10` wash takes the paired **`text-*`** token. A **solid** fill takes **`*-foreground`**
  (`bg-success` + `text-success-foreground`). Swapping these produces invisible text.
- The rail is dark chrome in *both* themes. Use `--rail-text` / `--rail-active` there;
  `--foreground` is dark ink in light mode and would be dark-on-dark.

### Deviations from the published specification

These were corrected because the specification's fixed value only worked in one theme:

| Spec value | Problem | Resolution |
| --- | --- | --- |
| Primary button text `#FFFFFF` in both themes | White on dark-mode `--signal` `#38BDF8` is ~1.9:1 | `--signal-on` is dark ink in dark mode |
| Accent badges fixed to `#F59E0B` / `#F43F5E` / `#A855F7` / `#38BDF8` | Illegible on their own light-mode washes | Theme-paired `--accent-*` inks |
| Table rule `rgba(28,52,80,0.4)`, row hover `rgba(255,255,255,0.02)` | Dark-mode-only values | `--table-rule`, `--row-hover` |
| `--slate-2` `#8395A1`; dark `--text-3` `#64748B` | 3.0:1 and 3.4:1 — both fail AA for metadata | Darkened / lightened respectively |
| Glass `--card` used for popovers | Page bleeds through, stacking text on text | `--popover` is opaque in dark mode |

The specification also still names teal `rgba(45, 212, 168, …)` for search focus and module
hover (§5.2B, §5.5), which contradicts the `--signal` blue it defines elsewhere. Those are
normalised to `--signal`.

## 11. Reference locations

| What to change or reuse | Location |
| --- | --- |
| Theme tokens, global focus, reduced motion, panel utilities | [`src/app/globals.css`](../src/app/globals.css) |
| Google fonts and default dark-theme startup | [`src/app/layout.tsx`](../src/app/layout.tsx) |
| Theme persistence/toggle behavior | [`src/components/theme-provider.tsx`](../src/components/theme-provider.tsx) |
| Base UI component implementations | [`src/components/ui`](../src/components/ui) |
| Page introductions, panels, metric/status/avatar/AI patterns | [`src/components/hrms/page-primitives.tsx`](../src/components/hrms/page-primitives.tsx) |
| App shell, hover dock, header, responsive rail | [`src/components/hrms/app-shell.tsx`](../src/components/hrms/app-shell.tsx) |
| Chart styles and data visualisation conventions | [`src/components/hrms/charts.tsx`](../src/components/hrms/charts.tsx) |
| Dashboard composition | [`src/components/hrms/dashboard.tsx`](../src/components/hrms/dashboard.tsx) |
| Authentication/brand expression | [`src/app/login/page.tsx`](../src/app/login/page.tsx) |
| shadcn setup and icon library choice | [`components.json`](../components.json) |

## 12. New-screen checklist

- [ ] Uses a `PageIntro` and `Surface`/shared primitive instead of reproducing a panel style.
- [ ] Uses semantic theme tokens and works in both dark and light mode.
- [ ] Keeps primary action on `--signal`, semantic feedback meaningfully classified, and AI violet/scoped.
- [ ] Uses Montserrat for headings/actions; Lato for body; tabular mono styling for factual figures.
- [ ] Fits the 4 px spacing rhythm, 40 px standard controls, and 8/12 px radius hierarchy.
- [ ] Has a mobile-first layout and moves secondary content rather than shrinking it indefinitely.
- [ ] Includes loading, empty, error, disabled, hover, focus, and selected states where applicable.
- [ ] Supports keyboard navigation, visible focus, labelled icons, and reduced motion.
- [ ] States the source/period of consequential data and does not present mock data as live.
