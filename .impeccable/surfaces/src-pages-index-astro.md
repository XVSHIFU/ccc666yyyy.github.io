---
version: 1
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/layouts/Base.astro"]
---

# Blog surface brief

Mode: homepage Experience / articles Read. Targets: src/pages/index.astro, src/components/HomeWorlds.astro, src/components/home/*, src/layouts/Base.astro.

The user selected Koharu, Firefly, Shirone, Solitude, Redefine, and Astro Cactus with shared content and functions. On 2026-10-07 the user rejected the first implementation: “现在看着都是一套模板，没有看出人家原来的模板的样式呢”. Original theme recognition now takes priority over an invented common visual language. Source-backed research and official screenshots are under .references/. Code-led execution; no generated UI comp is approved.

## Direction contract

THESIS: One personal blog with six recognizable original-theme compositions, not a common hero/card layout decorated six ways.

OWN-WORLD: Koharu preserves a 60svh wave cover, 256px sidebar navigation, and alternating diagonal image cards. Firefly preserves floating navigation, a 65vh wave banner, three columns and right-cover cards. Shirone preserves a purple Material palette, full-width banner, square identity picture, and statistics/calendar rail. Solitude starts directly with category capsules and a magazine grid beside the blue author card. Redefine opens with a full-height image, centered type, bottom social controls and a scroll cue. Cactus uses a 768px monospaced journal, two-row header and plain dated indexes.

STORY: Identify qinghe, discover the same original and clearly marked example posts through the selected theme, read one shared article, change appearance without leaving its address or section.

FIRST VIEWPORT: Each theme has its own Astro homepage fragment and content hierarchy. Redefine is an immersive cover; Cactus contains actual indexes immediately; Solitude starts with posts; the three wave-banner themes retain their individually measured navigation, rails, post shapes and rhythm. Shared marketing slogans and shared hero CTAs are removed.

FORM: The six homepage fragments are stored in inert templates; only the selected fragment is mounted. Theme CSS loads on demand. Articles retain one semantic body with stable IDs, shared search, theme/color settings and contact functionality. Locally generated or retained user artwork substitutes for upstream demo illustrations; no unlicensed demo artwork is shipped. Source layouts inform independently written adaptations, not unmodified upstream installations.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Theme-switch motion extension (2026-10-07)

The user tried the switcher and found switching perceptibly laggy. They requested a loading transition: ink spreads randomly from the clicked theme across the viewport while the next theme loads. Preserve all six layouts; this is an extension to their shared switcher.

Focal moment: irregular layered ink diffusion starts at the actual click (keyboard uses the chosen card's center), covers the screen, then dissolves to the selected world. Load CSS and initial images concurrently with the cover; swap layout only under opaque ink and restore reading position before reveal. Successful selection closes the chooser so the new world is directly visible. Failure/cancellation retains the current world and chooser.

The user then requested lighter ink and slower motion with a pause after seeing the first live effect. The subsequent gray-green attempt was also rejected. Use neutral paper / dilute charcoal with a broad soft diffusion front, no thick dark contour and no broken, toothed edges. Dark mode keeps a neutral charcoal ground without a white flash.

Budget: no motion dependency, no second native View Transition snapshot; bounded Canvas 2D paths/backing pixels, paint only during 900ms entrance and 650ms exit. Hold full coverage at least 550ms, overlapping network preparation, and remain static during longer network waits. Reduced motion uses a short 100ms fade with no imposed hold. Native dialog protects keyboard state, Escape and a delayed cancel control can abort loading; no fabricated progress percentage.


## Ten-reference extension (2026-10-07)

User request: add https://traveritas.github.io/articles/ and the nine sites in knowledge-base D-018, while keeping prior themes. This extends the original contract to sixteen independent appearances. The user has authorized local implementation; no new visual approval gate is implied. Code-led reference adaptations, no approved pixel comp.

THESIS: Preserve each source's recognizable composition while making it a readable personal blog.
OWN-WORLD / FIRST VIEWPORT: Traveritas — restrained serif article index, year groups, inclined seam and translucent ambient windows; Radar — black/green observation console and sweep; Good Fella — orange ASCII volume and black editorial typography; AVA — gray/cream, point-cloud letter sculpture and enormous wordmark; Nfinite — full-bleed cover then pale-blue content and layered paper particles; Follow.art — orange letterforms and tilted artwork cards; Milkin — sage negative space, small type, original stone still life and offset gallery; Digilab — pale natural field / large purple title, violet scrolling chapter; Stefan — blue oversized type and horizontal geometric slices; Büro18 — spiral date route leading into horizontal article chapters (vertical on phones).
FORM: New components and lazy theme styles extend the existing registry. Only one homepage main is mounted. Original author copy/visual assets are not impersonated: shared real blog content and clearly marked examples replace reference marketing content. Dedicated code geometry and local media stand in for proprietary site assets; the Milkin focal object is an independently generated raster, not the source WebGL model.
STORY: Open appearance, browse actual previews by group, switch from the chosen point through gentle neutral diffusion, land in the selected composition and keep reading the same content.
QUALITY BAR: Verified official screenshots and source notes under .references/reference-themes-a/, .references/reference-themes-b/, .references/traveritas-shots/ and .references/ink-reference/. Original visual identity outranks generic cleanliness, while shared controls, text contrast, touch navigation and reduced motion remain required.
