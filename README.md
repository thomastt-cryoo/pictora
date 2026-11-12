# Paint by Numbers Generator

A fully client-side web app that turns a photo into a printable paint-by-numbers
template. Upload an image, pick or generate a color palette, tune the region and
styling controls, and export the result as scalable **SVG** or a high-resolution
**PNG**. Everything runs in the browser — no server, no uploads leave your machine.

## Features

- **Palette sources**: auto-generate from the source image, extract from a photo
  of your actual paints (colors are de-duplicated), or build one manually.
- **Region controls**: smoothing/complexity, minimum shape size (removes tiny
  unpaintable islands), detail resolution, and 4/8-way edge connectivity.
- **Output styling**: background color, line color & thickness, label color &
  size, and an optional faint color-preview fill.
- **Scalable output**: outlines are vectorized, so any canvas size stays crisp.
- **Responsive UI**: heavy image processing runs in a Web Worker with a progress
  bar; style-only tweaks re-render instantly without re-segmenting.

## How it works

The segmentation pipeline (in `src/pipeline/`, run inside `src/workers/pbn.worker.ts`):

1. **Downscale** to a working resolution.
2. **Blur** to suppress noise (`preprocess.ts`).
3. **Quantize** each pixel to the nearest palette color in CIELAB space (`quantize.ts`).
4. **Label** connected regions (`regions.ts`).
5. **Merge** regions below the minimum size into their best neighbor (`merge.ts`).
6. **Trace** boundaries with marching-squares edge stitching + Douglas–Peucker
   simplification (`contours.ts`).
7. **Place labels** at each region's largest inscribed circle via a distance
   transform (`labelPlacement.ts`).
8. **Render** the cached region model to SVG (`src/render/toSVG.ts`); PNG export
   rasterizes that SVG (`src/render/toPNG.ts`).

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit + integration tests (Vitest)
npm run build    # production build to dist/
```

## Deployment (GitHub Pages)

Pushing to `main`/`master` runs `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. In the repo settings, set **Pages → Source = GitHub Actions**.

The Vite `base` is set to `/PaintByNumbers/` in `vite.config.ts` for a project
page at `https://<user>.github.io/PaintByNumbers/`. If your repo has a different
name (or you use a user/org page served from `/`), update `base` accordingly — or
build with `BASE_PATH=/ npm run build`.
