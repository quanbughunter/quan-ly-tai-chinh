"""Logo QLTC: Q và C là hai vòng, L và T dùng chung một thanh ngang, đuôi chữ Q vắt qua góc chữ L.

Chạy:  python3 tools/make_logo.py
- Ghi web/icons/icon.svg và các SVG nguồn trong tools/logo/ (không cần thư viện nào).
- Nếu máy có Playwright (pip install playwright && playwright install chromium) thì xuất luôn các file PNG.
  PNG đã có sẵn trong kho nên bước này chỉ cần khi bạn đổi màu / hình.
"""
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = os.path.join(ROOT, 'web', 'icons')
ASSETS = os.path.join(ROOT, 'assets')            # chỉ chứa PNG cho @capacitor/assets (icon-only / icon-foreground / icon-background)
SRC = os.path.join(ROOT, 'tools', 'logo')        # SVG nguồn trung gian
for d in (WEB, ASSETS, SRC):
    os.makedirs(d, exist_ok=True)

# ── màu ──
BG_A, BG_B = '#6a5cf0', '#2d2391'     # nền chàm: sáng (trên trái) → đậm (dưới phải)
RING = '#ffffff'                       # chữ Q
RING2 = '#d8d1ff'                      # chữ C (tím nhạt, nằm "dưới" Q nên dễ thấy là hai chữ lồng nhau)
BAR = '#ff9bba'                        # L và T (hồng san hô)
# Bản dùng trên nền sáng (ví dụ in ra giấy)
RING_ON_LIGHT, RING2_ON_LIGHT, BAR_ON_LIGHT = '#4f3fd1', '#9a8cf5', '#f2668f'

# ── hình học (hệ 1024) ──
W = 72           # nét
R = 148          # bán kính đường tâm của vòng Q, C
HALF = 165       # tâm Q ở y = 512 − HALF, tâm C ở y = 512 + HALF (hai vòng chồng lên nhau, Q nằm trên)
GAP = 44         # độ mở của chữ C (±độ quanh trục ngang)
CUT = 15         # khe hở tại chỗ đuôi Q vắt qua thanh
COL_GAP = 70     # từ mép ngoài vòng Q tới đường tâm nét đứng của chữ L (nét dày 72 nên khe thật = 70 − 36)
TAIL_OUT = 90    # đuôi Q nhô ra khỏi mép ngoài của vòng bao nhiêu (px)
TAIL_DEG = 40    # hướng đuôi Q (độ, 45 = chéo xuống bên phải)


def P(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def layout():
    """Trả về các đường (đường tâm) trước khi căn giữa."""
    xs = 292
    qy, cy = 512 - HALF, 512 + HALF
    bx0 = xs + R + W / 2 + COL_GAP
    bx1 = bx0 + 300
    by = 512
    top, bot = qy - R, cy + R
    stem_t = (bx0 + bx1) / 2 + 25
    q = f'M{f(xs - R)} {f(qy)} a{R} {R} 0 1 0 {2 * R} 0 a{R} {R} 0 1 0 {-2 * R} 0'
    x0, y0 = P(xs, cy, R, -GAP)
    x1, y1 = P(xs, cy, R, GAP)
    c = f'M{f(x0)} {f(y0)} A{R} {R} 0 1 0 {f(x1)} {f(y1)}'
    tx0, ty0 = P(xs, qy, R, TAIL_DEG)
    tx1, ty1 = P(xs, qy, R + W / 2 + TAIL_OUT - W / 2, TAIL_DEG)   # đầu mút nét (tâm của nắp tròn)
    tail = f'M{f(tx0)} {f(ty0)} L{f(tx1)} {f(ty1)}'
    bars = f'M{f(bx0)} {f(top)} V{by} H{f(bx1)} M{f(stem_t)} {by} V{f(bot)}'
    stem = f'M{f(bx0)} {f(top)} V{by}'
    # hộp bao (đã tính nửa nét) để căn giữa
    box = (xs - R - W / 2, top - W / 2, bx1 + W / 2, bot + W / 2)
    return {'q': q, 'c': c, 'tail': tail, 'bars': bars, 'stem': stem, 'box': box}


def far_point(g):
    """Khoảng cách xa nhất từ tâm 512,512 tới mép nét sau khi căn giữa (để vừa vùng an toàn của icon Android)."""
    x0, y0, x1, y1 = g['box']
    dx, dy = 512 - (x0 + x1) / 2, 512 - (y0 + y1) / 2
    xs = 292
    qy, cy = 512 - HALF, 512 + HALF
    pts = []
    for cx_, cy_ in [(xs, qy), (xs, cy)]:
        for a in range(0, 360, 4):
            pts.append(P(cx_, cy_, R, a))
    bx0 = xs + R + W / 2 + COL_GAP
    bx1 = bx0 + 300
    stem_t = (bx0 + bx1) / 2 + 25
    for p in [(bx0, qy - R), (bx0, 512), (bx1, 512), (stem_t, 512), (stem_t, cy + R)]:
        pts.append(p)
    return max(math.hypot(px + dx - 512, py + dy - 512) for px, py in pts) + W / 2


def mark(ring=RING, bar=BAR, scale=1.0, ring2=None):
    ring2 = ring2 or RING2
    g = layout()
    x0, y0, x1, y1 = g['box']
    dx, dy = 512 - (x0 + x1) / 2, 512 - (y0 + y1) / 2
    def mask(id_, d):
        return (f'<mask id="{id_}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="2048" height="2048">'
                f'<rect x="-512" y="-512" width="2048" height="2048" fill="#fff"/>'
                f'<path d="{d}" fill="none" stroke="#000" stroke-width="{W + 2 * CUT}" stroke-linecap="round"/></mask>')
    st = f'fill="none" stroke-width="{W}" stroke-linecap="round" stroke-linejoin="round"'
    # thứ tự lớp: chữ C (bị vòng Q đè lên) < vòng Q (bị nét đứng chữ L đè lên) < thanh L/T (bị đuôi Q đè lên) < đuôi Q
    return (f'<defs>{mask("cutq", g["stem"])}{mask("cutc", g["q"])}{mask("cut", g["tail"])}</defs>'
            f'<g transform="translate(512 512) scale({scale}) translate({f(dx - 512)} {f(dy - 512)})">'
            f'<g mask="url(#cutq)"><path d="{g["q"]}" {st} stroke="{ring}"/></g>'
            f'<g mask="url(#cutc)"><path d="{g["c"]}" {st} stroke="{ring2}"/></g>'
            f'<g mask="url(#cut)"><path d="{g["bars"]}" {st} stroke="{bar}"/></g>'
            f'<path d="{g["tail"]}" {st} stroke="{ring}"/></g>')


def gradient(id_='bg'):
    return (f'<defs><linearGradient id="{id_}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1024" y2="1024">'
            f'<stop offset="0" stop-color="{BG_A}"/><stop offset="1" stop-color="{BG_B}"/></linearGradient></defs>')


def svg(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">{body}</svg>\n'


def build():
    far = far_point(layout())
    FG_SCALE = min(1.0, 335 / far)        # icon thích ứng Android: nằm gọn trong vùng an toàn
    MASKABLE_SCALE = min(1.0, 0.40 * 1024 / far)   # PWA maskable: vòng an toàn bán kính 40%
    ONLY_SCALE = 0.92

    files = {
        # icon chính (góc bo, nền trong suốt ngoài góc) — dùng cho favicon, header, PWA
        os.path.join(WEB, 'icon.svg'): svg(gradient() + '<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>' + mark(scale=1.0)),
        # nguồn PNG
        os.path.join(SRC, 'icon-maskable.svg'): svg(gradient() + '<rect width="1024" height="1024" fill="url(#bg)"/>' + mark(scale=MASKABLE_SCALE)),
        os.path.join(SRC, 'icon-only.svg'): svg(gradient() + '<rect width="1024" height="1024" fill="url(#bg)"/>' + mark(scale=ONLY_SCALE)),
        os.path.join(SRC, 'icon-foreground.svg'): svg(mark(scale=FG_SCALE)),
        os.path.join(SRC, 'icon-background.svg'): svg(gradient() + '<rect width="1024" height="1024" fill="url(#bg)"/>'),
        # bản cho nền sáng (tùy dùng)
        os.path.join(SRC, 'logo-on-light.svg'): svg('<rect width="1024" height="1024" rx="230" fill="#f7f4ff"/>' + mark(RING_ON_LIGHT, BAR_ON_LIGHT, 1.0, RING2_ON_LIGHT)),
    }
    for path, text in files.items():
        with open(path, 'w', encoding='utf8') as fh:
            fh.write(text)
    print('đã ghi', len(files), 'file SVG')

    pngs = [  # (svg, png, kích thước, giữ nền trong suốt?)
        (os.path.join(WEB, 'icon.svg'), os.path.join(WEB, 'icon-512.png'), 512),
        (os.path.join(WEB, 'icon.svg'), os.path.join(WEB, 'icon-192.png'), 192),
        (os.path.join(SRC, 'icon-maskable.svg'), os.path.join(WEB, 'icon-maskable-512.png'), 512),
        (os.path.join(SRC, 'icon-only.svg'), os.path.join(WEB, 'apple-touch-icon.png'), 180),   # iOS tự bo góc nên cần nền đặc, không trong suốt
        (os.path.join(SRC, 'icon-only.svg'), os.path.join(ASSETS, 'icon-only.png'), 1024),
        (os.path.join(SRC, 'icon-foreground.svg'), os.path.join(ASSETS, 'icon-foreground.png'), 1024),
        (os.path.join(SRC, 'icon-background.svg'), os.path.join(ASSETS, 'icon-background.png'), 1024),
    ]
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('Chưa cài Playwright — bỏ qua bước xuất PNG (PNG hiện có vẫn dùng được).')
        return
    with sync_playwright() as p:
        b = p.chromium.launch()
        for src, out, px in pngs:
            pg = b.new_page(viewport={'width': px, 'height': px})
            body = open(src, encoding='utf8').read().replace('<svg ', f'<svg width="{px}" height="{px}" ', 1)
            pg.set_content(f'<html><body style="margin:0;background:transparent">{body}</body></html>')
            pg.screenshot(path=out, omit_background=True)
            pg.close()
        b.close()
    print('đã xuất', len(pngs), 'file PNG; icon-only/background là nền đặc, foreground trong suốt')


if __name__ == '__main__':
    build()
