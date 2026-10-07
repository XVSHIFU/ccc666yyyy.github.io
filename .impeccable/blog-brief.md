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

## Theme-switch motion extension

The user's subsequent trial found switching perceptibly laggy. The requested shared transition starts randomized water-ink diffusion at the clicked theme, covers the viewport while the selected stylesheet and first-view images load, then dissolves to the new theme. Success closes the appearance chooser; cancellation/failure preserves the old theme and chooser. The six reference compositions stay unchanged.

The registered surface brief carries the detailed motion contract and runtime budget. Canvas painting is bounded to the entrance/exit, no additional motion dependency or native View Transition snapshot is used, and reduced-motion gets short opacity feedback. Preserve article DOM, URL, focus, scroll position, cancellation, and load-error recovery.
