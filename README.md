# 95-ground-tiles

Ground imagery tiles for NINETY5IVE's Try Your Seat (served by GitHub Pages). Nothing else lives here: no code, no keys, no personal data.

- `v1/<route>/L<level>/<i>_<j>.webp`: 1024 px tiles at 30 m (L0), 60 m (L1) and 120 m (L2) along each route. Each texel is the ratio between
  NASA HLS's colour and its own 500 m blur (128 + 42.5 x log2(ratio)); the page multiplies NASA Blue Marble's colour by it.
- `v1/ground_detail.json`: the grid, and the NASA scene IDs behind every tile.
- Written by `build_ground_hls.py` in the app repo. Only cloud-free pixels (NASA's own Fmask) are used; nothing is filled or upscaled.

Credits: NASA Harmonized Landsat Sentinel-2 (HLS) v2.0, HLSL30 and HLSS30 (LP DAAC). HLSS30 contains modified Copernicus Sentinel-2 data.
Colour under the detail: NASA Earth Observatory Blue Marble Next Generation.
