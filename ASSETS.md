# Visual assets

The landscape and spring backgrounds were generated on 2026-10-07 using Codex's built-in `image_gen` tool. No CLI/API fallback was used. These are original background illustrations made for this blog, not screenshots or copied theme artwork. Their source PNGs and exact prompt text files are retained in `assets/originals/`, outside the published `public/` directory. Only the compressed WebP images are served. The avatar and portrait are retained pre-existing repository artwork, not generated assets.

| Asset | Dimensions | Website usage |
| --- | --- | --- |
| `assets/originals/landscape.png` | 1983 × 793 | Retained original river-valley artwork; not published |
| `public/media/landscape.webp` | 1983 × 793 | Firefly and Redefine banners; selected article and category covers |
| `assets/originals/spring.png` | 1983 × 793 | Retained original spring riverside artwork; not published |
| `public/media/spring.webp` | 1983 × 793 | Koharu and Shirone banners; selected article and category covers |
| `assets/originals/milkin-stone.png` | 1536 × 1024 | Retained original isolated basalt sculpture; not published |
| `public/media/milkin-stone.webp` | 900 × 600 | Milkin theme hero focal object; real alpha transparency, 139,398 bytes |
| `public/previews/*.webp` (16 theme IDs) | 480 × 333 each | Actual local homepage screenshots displayed in the appearance chooser; Traveritas, Stefan and Good Fella refreshed after their motion/layout corrections |

Both images were visually inspected with `view_image`. The generated dimensions differ from the aspirational width in the prompts, but preserve the requested approximately 2.5:1 panoramic composition. WebP derivatives use Sharp quality 86, effort 6, without cropping or resizing. Titles and all interface elements should be rendered as HTML, not embedded in the image. Add theme-appropriate scrims and text contrast in CSS.

Existing artwork used in the site:

- `public/media/avatar.webp` derives from retained repository original `img/touxiang.jpg`.
- `public/media/portrait.webp` derives from retained repository original `img/leisai-background.png`.
- Both existing assets preserve their source identity. Their provenance records identify the source files and do not claim AI generation or a new license.

The six appearance thumbnails are browser screenshots of this project's rendered pages, captured at 1440 × 1000 and reduced to 480 × 333 by `scripts/capture.mjs`. They are not screenshots of the upstream theme demos or generated mockups. Each has an adjacent origin JSON record. Upstream reference screenshots remain outside the published directory in the ignored `.references/` folder.

## Landscape — exact generation prompt

```text
Use case: illustration-story
Asset type: production panoramic background illustration for a personal blog, not a UI mockup.
Primary request: Create a polished, exquisite original Japanese countryside painted landscape: a luminous green river valley, a gently curving rural railway following the water, a tiny cottage beside the rails, forested mountains receding into atmospheric layers, expansive blue sky and soft clouds, warm late-afternoon sunlight.
Style/medium: richly crafted hand-painted digital background art, fine natural brushwork, delicate grass and tree texture, crisp foreground details with soft distant landscape. A cinematic pastoral illustration with an inviting sense of quiet adventure, not a photograph, not vector art, not a 3D render. Do not imitate any particular living artist.
Composition/framing: ultra-wide panoramic landscape, approximately 2.5:1 aspect ratio, intended at least 2500 pixels wide. Strong visual focal detail in the right half and along the lower edge: cottage on the right bank, railway winding into the right-middle distance, dark leafy trees framing the right edge. Keep middle-left and upper-left as an uncluttered medium-blue sky and distant soft blue-green hills, giving generous calm negative space for white website headline text that will be added separately. Low horizon around the lower third. The river should lead the eye naturally across the lower foreground. Cohesive graceful composition, subtle depth, no extreme perspective.
Lighting/mood: luminous warm afternoon, gentle sunlit highlights, cool shaded foliage, fresh air, tranquil and wistful.
Color palette: emerald and sage greens, deep forest accents, turquoise water, clear blue sky, soft warm cream clouds.
Constraints: landscape image only. Absolutely no text, no typography, no UI, no borders, no watermarks, no logo, no brand, no people. The image should be beautiful as an actual full-width website background.
```

## Spring — exact generation prompt

```text
Use case: illustration-story
Asset type: production panoramic background illustration for a personal blog, not a UI mockup.
Primary request: Create an original, exquisite Japanese spring riverside landscape with soft pale-pink cherry blossoms framing the right edge and the upper corners, a quiet narrow river reflecting the sky, a small riverside path, distant green hills and a tiny white cottage on the right bank.
Style/medium: elegant hand-painted digital illustration with delicate gouache-like texture, soft luminous color, lovingly detailed blossoms and grasses, crisp pleasant silhouettes, refined visual finish. Cheerful personal sketchbook atmosphere without childish clip-art. Do not imitate any particular living artist.
Composition/framing: ultra-wide panoramic landscape, approximately 2.5:1 aspect ratio, intended at least 2500 pixels wide. Horizon in lower third; focus the cherry trees and cottage in the right half. Keep the middle-left and upper-left mostly calm powder-blue sky with a few wispy cloud accents to leave negative space for separately added blog headline. Let a ribbon of river lead across the lower foreground. Blossoms must frame rather than obscure the calm center.
Lighting/mood: gentle clear spring morning, airy and inviting, pale warm sunlight, dreamy without heavy blur.
Color palette: powder blue, blush pink, fresh mint and sage greens, warm ivory highlights, modest darker blue accents for depth.
Constraints: landscape illustration only. No text, no typography, no logo, no UI, no watermark, no people, no animals, no collage, no border. It must work as a real full-width website background and remain legible under a subtle text overlay.
```

## Provenance

- Landscape tool output: `C:\Users\Xvsf\.codex\generated_images\01a115a3-7338-73f1-9b47-7038afe335aa\exec-46140f98-b20a-4bb6-b354-1743686ca7b1.png`.
- Spring tool output: `C:\Users\Xvsf\.codex\generated_images\01a115a3-7338-73f1-9b47-7038afe335aa\exec-82d2d3e6-5fb3-4387-98f0-0ae0ab9cf48d.png`.
- Selected source outputs are retained at `assets/originals/landscape.png` and `assets/originals/spring.png`. Consuming code uses only the compressed derivatives in `public/media/`.
- Exact generation prompts are also retained as `assets/originals/landscape.prompt.txt` and `assets/originals/spring.prompt.txt` and embedded into both original PNGs through Impeccable's `embed-prompt` tool.
- The same tool stores WebP provenance in adjacent `*.webp.json` sidecars because it does not embed metadata directly in this format. Generated WebP sidecars contain the exact generation prompt; avatar and portrait sidecars contain their pre-existing source origin. No image pixels were changed during this provenance step.
- Prompts request no imitation of a particular living artist, and no text, UI, brands, watermarks, or people.

## Milkin stone — original transparent focal asset

Generated with the built-in `image_gen` tool using `transparent_background: true`. The reference website screenshot was inspected only to understand its stone-led visual composition. No source-site image, branded model, or screenshot pixels were reused. This original basalt block was generated from the text below without reference-image inputs.

- Original tool output: `C:\Users\Xvsf\.codex\generated_images\01a115a3-7338-73f1-9b47-7038afe335aa\exec-b04bb40a-758d-4ca1-9e47-33654a3df7d8.png`.
- Retained PNG: `assets/originals/milkin-stone.png`; exact prompt: `assets/originals/milkin-stone.prompt.txt`.
- Shipping asset: `public/media/milkin-stone.webp`, resized proportionally to 900 × 600 with Sharp; WebP quality 84, alpha quality 100, effort 6; no flattening or background removal.
- Alpha verified in the original and the shipping WebP. Light and dark composites were visually checked for clean edges; temporary check images were removed afterward.
- The generated stone occupies more of the frame than the prompt's approximate 60% target; it remains completely visible with clear transparent margins.
- Exact prompt embedded in original PNG and recorded in `public/media/milkin-stone.webp.json` through Impeccable's format fallback.

```text
Use case: product-mockup
Asset type: isolated original sculptural stone cutout for a minimalist personal blog hero.
Primary request: Create one substantial irregular thick rectangular block of natural black-brown basalt, suspended in empty space, shown diagonally in a three-quarter view so its front, top and right side reveal believable three-dimensional volume. It should feel like a geological sculpture, not a manufactured cube: broken rough corners, organically fractured planes, small weathered pits and subtle coarse mineral grain.
Style/medium: very high-end photorealistic studio still-life photography; tactile matte volcanic stone with restrained realistic detail, no stylized cartoon or vector treatment. Original shape, not a reproduction of any branded sculpture or model.
Composition/framing: wide horizontal 3:2 canvas, complete single stone occupying approximately 60 percent of the canvas width and 65 percent of its height, centered with generous transparent margins on all sides. The long axis tilts gently upward to the right. No cropping. Strong readable silhouette, solid massive depth.
Lighting/mood: soft large studio light above and to the right, gentle neutral highlights across top and right planes, naturally darker front-left plane while preserving visible texture. Quiet, monumental, low reflection. No dramatic glow.
Color palette: neutral black-brown basalt, charcoal shadows, muted warm-grey mineral flecks. No colored lighting, no metallic shine.
Constraints: genuinely transparent background with real alpha channel. Only the isolated stone is visible. No background color, no painted checkerboard, no floor, no ground plane, no pedestal, no cast shadow on a ground, no second stone, no floating particles, no text, no letters, no logos, no watermark, no other objects. Preserve the stone's entire silhouette and fine irregular edge on transparency.
```
