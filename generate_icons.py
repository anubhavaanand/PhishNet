#!/usr/bin/env python3
"""
Simple icon generator for PhishNet
Creates PNG icons using PIL (Pillow)
Run: python3 generate_icons.py
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not installed. Install with: pip install pillow")
    exit(1)

import os

# Create icons directory
os.makedirs('public/icons', exist_ok=True)

# Colors
BG_COLOR = (14, 165, 233)  # #0ea5e9
BG_COLOR_END = (59, 130, 246)  # #3b82f6
TEXT_COLOR = (255, 255, 255)

def create_gradient_background(size):
    """Create a gradient background"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    for y in range(size):
        ratio = y / size
        r = int(BG_COLOR[0] * (1 - ratio) + BG_COLOR_END[0] * ratio)
        g = int(BG_COLOR[1] * (1 - ratio) + BG_COLOR_END[1] * ratio)
        b = int(BG_COLOR[2] * (1 - ratio) + BG_COLOR_END[2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Rounded corners
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = size // 5  # 20% rounded
    mask_draw.rounded_rectangle([0, 0, size, size], radius=radius, fill=255)

    img.putalpha(mask)
    return img

def add_fishing_emoji(img, size):
    """Add fishing emoji/text to center"""
    draw = ImageDraw.Draw(img)

    # Try to use a system font
    font_size = size // 2
    try:
        # Try common font paths
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "C:/Windows/Fonts/arial.ttf",
        ]
        font = None
        for path in font_paths:
            try:
                font = ImageFont.truetype(path, font_size)
                break
            except:
                continue

        if font is None:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    # Draw fishing emoji approximation (since emoji rendering varies)
    # Use text "🎣" or "PhishNet"
    text = "🎣" if size >= 32 else "PN"

    # Get text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20

    # Draw text with shadow
    draw.text((x + 1, y + 1), text, font=font, fill=(0, 0, 0, 100))
    draw.text((x, y), text, font=font, fill=TEXT_COLOR)

    # Add "PhishNet" text at bottom for larger icons
    if size >= 48:
        small_font_size = size // 8
        try:
            small_font = ImageFont.truetype(font_paths[0] if 'font_paths' in locals() else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", small_font_size)
        except:
            small_font = ImageFont.load_default()

        brand_text = "PhishNet"
        bbox = draw.textbbox((0, 0), brand_text, font=small_font)
        text_width = bbox[2] - bbox[0]
        x = (size - text_width) // 2
        y = size - size // 5

        draw.text((x + 1, y + 1), brand_text, font=small_font, fill=(0, 0, 0, 100))
        draw.text((x, y), brand_text, font=small_font, fill=(255, 255, 255, 230))

    return img

# Generate icons
for size in [16, 32, 48, 128]:
    img = create_gradient_background(size)
    img = add_fishing_emoji(img, size)
    output_path = f'public/icons/icon-{size}.png'
    img.save(output_path, 'PNG')
    print(f"Created {output_path} ({size}x{size})")

print("\nAll icons generated successfully!")