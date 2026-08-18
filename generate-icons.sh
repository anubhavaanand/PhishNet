#!/bin/bash
# Icon generation script for PhishNet
# Requires: ImageMagick (convert) or Inkscape

# Create icons directory
mkdir -p public/icons

# Option 1: Using ImageMagick (convert)
# convert public/icons/icon.svg -resize 16x16 public/icons/icon-16.png
# convert public/icons/icon.svg -resize 32x32 public/icons/icon-32.png
# convert public/icons/icon.svg -resize 48x48 public/icons/icon-48.png
# convert public/icons/icon.svg -resize 128x128 public/icons/icon-128.png

# Option 2: Using Inkscape
# inkscape public/icons/icon.svg --export-type=png --export-width=16 --export-filename=public/icons/icon-16.png
# inkscape public/icons/icon.svg --export-type=png --export-width=32 --export-filename=public/icons/icon-32.png
# inkscape public/icons/icon.svg --export-type=png --export-width=48 --export-filename=public/icons/icon-48.png
# inkscape public/icons/icon.svg --export-type=png --export-width=128 --export-filename=public/icons/icon-128.png

# Option 3: Using rsvg-convert (librsvg)
# rsvg-convert -w 16 -h 16 public/icons/icon.svg -o public/icons/icon-16.png
# rsvg-convert -w 32 -h 32 public/icons/icon.svg -o public/icons/icon-32.png
# rsvg-convert -w 48 -h 48 public/icons/icon.svg -o public/icons/icon-48.png
# rsvg-convert -w 128 -h 128 public/icons/icon.svg -o public/icons/icon-128.png

echo "Icon generation script ready."
echo "Run one of the options above after installing the required tool."
echo ""
echo "Quick test with Python (if available):"
echo "  python3 -c \""
echo "import cairosvg"
echo "for size in [16, 32, 48, 128]:"
echo "    cairosvg.svg2png(url='public/icons/icon.svg', write_to=f'public/icons/icon-{size}.png', output_width=size, output_height=size)"
echo "  \""
echo ""
echo "Or use online converter: https://convertio.co/svg-png/"