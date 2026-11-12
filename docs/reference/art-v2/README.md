# Sprite set v2 (Dust & Hooves)

AI generated (GenerateImage) in the approved test style: painterly realistic, 3/4 isometric ~35 deg, light top-left.
- raw/    original generated sheets (jpg). *-rejected.jpg = discarded attempts. *-green.jpg = steel items re-rendered on chroma green (galvanised steel cannot be keyed off light grey).
- final/  cut-out transparent PNGs, manifest.json, contact-sheet.png
- tools/  cutout.py (grey + green keyers), build.py (slice, scale, mirror, anchors, tiles, contact sheet). Rebuild: `cd tools && python3 build.py`
- refs/   cattle yard reference photos

Scale: adult cow side-profile length 240 px, calf 144 px, standing person 132 px (0.55 x cow length).
Other categories are game-scale, not real-world scale (a real-scale house would be ~6x a cow).
Anchors in manifest.json are normalised (0..1) for Phaser setOrigin; y = feet/footprint base.
Facings: S front, N back, SE/SW towards camera right/left, NE/NW away right/left, E/W side. Left-facing files are horizontal mirrors (mirrored_from).
Ground tiles: 512x512 square, seamless (offset blend). Project onto the iso grid in-engine (tileSprite) rather than using as diamonds.
