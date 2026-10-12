"""Tạo icon ứng dụng (PNG) cho PWA và Android. Chạy: python3 tools/make_icons.py"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web', 'icons')
ASSETS = os.path.join(ROOT, 'assets')
os.makedirs(WEB, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)

A = (155, 140, 255)   # tím pastel
B = (245, 163, 182)   # hồng pastel
VIOLET = (116, 102, 236)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def gradient(size):
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
    return img


def coin(size, scale):
    """Đồng xu trắng có chữ ₫ — vẽ ở độ phân giải cao rồi thu nhỏ cho mịn."""
    S = size * 3
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = S * scale / 2
    c = S / 2
    # bóng nhẹ
    shadow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse([c - r, c - r + S * 0.02, c + r, c + r + S * 0.02], fill=(60, 40, 140, 70))
    layer.alpha_composite(shadow)
    d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255, 255))
    d.ellipse([c - r * 0.82, c - r * 0.82, c + r * 0.82, c + r * 0.82], outline=(226, 221, 255, 255), width=max(2, int(S * 0.012)))
    font = ImageFont.truetype(FONT, int(r * 1.25))
    d.text((c, c), '₫', font=font, fill=VIOLET + (255,), anchor='mm')
    return layer.resize((size, size), Image.LANCZOS)


def rounded(img, radius_ratio):
    S = img.size[0]
    mask = Image.new('L', (S * 2, S * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S * 2 - 1, S * 2 - 1], radius=int(S * 2 * radius_ratio), fill=255)
    mask = mask.resize((S, S), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img.convert('RGBA'), (0, 0), mask)
    return out


def make(size, scale, rounded_ratio=None):
    base = gradient(size).convert('RGBA')
    base.alpha_composite(coin(size, scale))
    return rounded(base, rounded_ratio) if rounded_ratio else base


make(512, 0.56, 0.22).save(os.path.join(WEB, 'icon-512.png'))
make(192, 0.56, 0.22).save(os.path.join(WEB, 'icon-192.png'))
make(512, 0.40).save(os.path.join(WEB, 'icon-maskable-512.png'))  # tràn viền, nội dung nằm trong vùng an toàn

# Nguồn cho @capacitor/assets (Android launcher + adaptive icon)
make(1024, 0.56).save(os.path.join(ASSETS, 'icon-only.png'))
gradient(1024).save(os.path.join(ASSETS, 'icon-background.png'))
coin(1024, 0.42).save(os.path.join(ASSETS, 'icon-foreground.png'))
print('done')
