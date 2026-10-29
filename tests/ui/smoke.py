"""Kiểm thử giao diện bằng Playwright (Python). Không chạy trong `npm test`.

Cách chạy (từ thư mục dự án):
    npx vite build --mode test --outDir /tmp/dist-ui --emptyOutDir
    python3 -m http.server 8140 -d /tmp/dist-ui &
    python3 tests/ui/smoke.py            # mặc định http://127.0.0.1:8140/
Bản dựng --mode test lộ window.__qltc = { store, seedDemo, forms, openDialog } để kịch bản gọi trực tiếp.
Chặn config.js để app vào chế độ thử (dữ liệu trong trình duyệt), nên không đụng tới Supabase thật.
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8140/'
FAILS = []


def check(name, cond, extra=''):
    print(('PASS ' if cond else 'FAIL ') + name + (f'  [{extra}]' if extra and not cond else ''))
    if not cond:
        FAILS.append(name)


FAKE_CAPACITOR = """
window.__back = { cb: null, minimized: 0 };
window.Capacitor = {
  isNativePlatform: () => true,
  isPluginAvailable: () => true,
  registerPlugin: () => ({
    addListener: (ev, cb) => { if (ev === 'backButton') window.__back.cb = cb; return Promise.resolve({ remove() {} }); },
    minimizeApp: () => { window.__back.minimized += 1; },
    exitApp: () => { window.__back.minimized += 100; },
  }),
};
"""


async def new_page(b, vp, scheme='light', capacitor=False):
    ctx = await b.new_context(viewport=vp, color_scheme=scheme, device_scale_factor=1)
    pg = await ctx.new_page()
    pg.logs = []
    pg.on('console', lambda m: pg.logs.append(m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: pg.logs.append('ERR ' + str(e)))
    await pg.route('**/config.js', lambda r: r.fulfill(body='window.APP_CONFIG = {};', content_type='application/javascript'))
    if capacitor:
        await pg.add_init_script(FAKE_CAPACITOR)
    await pg.goto(URL)
    for _ in range(80):
        if await pg.evaluate('!!(window.__qltc && window.__qltc.store.ready)'):
            break
        await pg.wait_for_timeout(100)
    return pg


async def seed(pg):
    await pg.evaluate('window.__qltc.seedDemo()')
    await pg.wait_for_timeout(700)


async def txs(pg):
    return await pg.evaluate("window.__qltc.store.all('txs').map(t => ({ id: t.id, kind: t.kind, amount: t.amount, currency: t.currency, accountId: t.accountId, note: t.note }))")


async def goto(pg, route):
    await pg.evaluate(f"location.hash = '#/{route}'")
    await pg.wait_for_timeout(500)


async def dialog_count(pg):
    return await pg.locator('[role=dialog]').count()


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()

        # ── Điện thoại 390×844 ─────────────────────────────────────────────
        pg = await new_page(b, {'width': 390, 'height': 844})
        await seed(pg)
        check('Tổng quan có thẻ tổng tài sản', await pg.get_by_text('Tổng tài sản ròng').count() > 0)
        check('thanh tab hiện, thanh bên ẩn', await pg.locator('nav[aria-label="Điều hướng chính"]').is_visible() and not await pg.locator('aside').is_visible())

        # Tab bar: mỗi tab đổi màn hình
        for label, title in [('Giao dịch', 'Giao dịch'), ('Tài khoản', 'Tài khoản'), ('Vay nợ', 'Vay nợ'), ('Tổng quan', 'Tổng quan')]:
            await pg.locator('nav[aria-label="Điều hướng chính"]').get_by_text(label, exact=True).click()
            await pg.wait_for_timeout(500)
            check(f'tab {label} mở đúng màn hình', await pg.locator('#view h1').first.inner_text() == title)
        await pg.locator('nav[aria-label="Điều hướng chính"]').get_by_text('Khác', exact=True).click()
        await pg.wait_for_timeout(400)
        more = await pg.locator('[role=dialog]').inner_text()
        check('menu Khác có đủ mục', all(x in more for x in ['Thu nhập', 'Báo tỉ giá', 'Tiền KTX', 'Học bổng MIIGAiK', 'Cài đặt']))
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(400)
        check('Esc đóng menu', await dialog_count(pg) == 0)

        # Không tràn ngang ở mọi màn hình
        for r in ['', 'tx', 'income', 'accounts', 'debts', 'fx', 'dorm', 'scholarship', 'settings']:
            await goto(pg, r)
            sw = await pg.evaluate('document.documentElement.scrollWidth')
            check(f'không tràn ngang ở #/{r}', sw <= 390, sw)

        # Thêm chi KHÔNG gắn tài khoản qua form giao dịch
        await goto(pg, '')
        before = await txs(pg)
        await pg.get_by_label('Thêm giao dịch').first.click()
        await pg.get_by_text('Khoản chi', exact=True).click()
        await pg.wait_for_timeout(500)
        d = pg.locator('[role=dialog]').last
        check('form Thêm giao dịch mở', 'Thêm giao dịch' in await d.inner_text())
        await d.locator('[data-slot=select-trigger]').first.click()
        await pg.get_by_role('option', name='— Không gắn tài khoản —').click()
        await pg.wait_for_timeout(300)
        check('hiện gợi ý không gắn tài khoản', 'không làm đổi số dư' in await d.inner_text())
        await d.locator('input[placeholder="0"]').first.fill('50k')
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(700)
        after = await txs(pg)
        new = [t for t in after if t['id'] not in {x['id'] for x in before}]
        check('đã lưu 1 khoản chi 50.000 không tài khoản', len(new) == 1 and new[0]['kind'] == 'expense' and new[0]['amount'] == 50000 and new[0]['accountId'] == '' and new[0]['currency'] == 'VND', new)

        # Nhập nhanh CÓ tài khoản: số dư đổi; KHÔNG tài khoản: số dư giữ nguyên
        bal0 = await pg.evaluate("(() => { const s = window.__qltc.store; return s.all('txs').filter(t => t.accountId).length })()")
        await pg.keyboard.press('q')
        await pg.wait_for_timeout(500)
        d = pg.locator('[role=dialog]').last
        await d.locator('textarea').fill('cafe 20k; trà sữa 35k')
        await pg.wait_for_timeout(300)
        await d.get_by_role('button', name='Lưu tất cả').click()
        await pg.wait_for_timeout(700)
        bal1 = await pg.evaluate("window.__qltc.store.all('txs').filter(t => t.accountId).length")
        check('Nhập nhanh có tài khoản: thêm 2 khoản gắn tài khoản', bal1 == bal0 + 2, (bal0, bal1))

        # Sửa một giao dịch từ danh sách
        await goto(pg, 'tx')
        await pg.locator('#view [data-slot=row]').first.click()
        await pg.wait_for_timeout(500)
        d = pg.locator('[role=dialog]').last
        check('bấm dòng mở form Sửa giao dịch', 'Sửa giao dịch' in await d.inner_text())
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(400)

        # Ẩn số dư
        await goto(pg, '')
        await pg.get_by_label('Ẩn số dư').click()
        await pg.wait_for_timeout(500)
        txt = await pg.locator('#view').inner_text()
        check('ẩn số dư: hero hiện •••••', '•••••' in txt)
        await pg.get_by_label('Hiện số dư').click()

        # Giao diện tối từ Cài đặt
        await goto(pg, 'settings')
        await pg.locator('#view').get_by_role('tab', name='Tối').click()
        await pg.wait_for_timeout(300)
        check('chọn Tối đổi data-theme', await pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'dark')
        await pg.locator('#view').get_by_role('tab', name='Sáng').click()
        check('chọn Sáng đổi data-theme', await pg.evaluate("document.documentElement.getAttribute('data-theme')") == 'light')

        # Báo tỉ giá: Sang 6.000.000 ₫
        await goto(pg, 'fx')
        inp = pg.locator('#view input').first
        await inp.fill('6tr')
        await pg.wait_for_timeout(400)
        fx_text = await pg.locator('#view').inner_text()
        check('Báo tỉ giá tính ra số RUB', '₽' in fx_text and 'GIÁ BÁO' in fx_text.upper())
        check('console sạch (điện thoại)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        # ── Nút Back của Android (Capacitor giả) ───────────────────────────
        pg = await new_page(b, {'width': 390, 'height': 844}, capacitor=True)
        await seed(pg)
        check('đã gắn trình nghe backButton', await pg.evaluate('!!window.__back.cb'))
        await goto(pg, 'accounts')
        await pg.get_by_role('button', name='Thêm').first.click()
        await pg.wait_for_timeout(500)
        n1 = await dialog_count(pg)
        await pg.evaluate('window.__back.cb({ canGoBack: true })')
        await pg.wait_for_timeout(500)
        check('Back đóng hộp thoại, chưa rời màn hình', n1 == 1 and await dialog_count(pg) == 0 and pg.url.endswith('#/accounts'), (n1, pg.url))
        await pg.evaluate('window.__back.cb({ canGoBack: true })')
        await pg.wait_for_timeout(500)
        check('Back tiếp theo lùi về màn trước', not pg.url.endswith('#/accounts'), pg.url)
        await goto(pg, '')
        await pg.evaluate('window.__back.cb({ canGoBack: false })')
        check('ở màn đầu: Back thu app xuống nền', await pg.evaluate('window.__back.minimized') == 1)
        # hộp thoại chồng: Back đóng từng lớp
        await pg.get_by_label('Thêm giao dịch').first.click()
        await pg.get_by_text('Khoản chi', exact=True).click()
        await pg.wait_for_timeout(500)
        await pg.locator('[role=dialog]').last.locator('[data-slot=select-trigger]').first.click()
        await pg.wait_for_timeout(300)
        await pg.evaluate('window.__back.cb({ canGoBack: true })')
        await pg.wait_for_timeout(400)
        check('Back đóng danh sách chọn trước, hộp thoại còn', await pg.locator('[data-slot=select-content]').count() == 0 and await dialog_count(pg) >= 1)
        await pg.evaluate('window.__back.cb({ canGoBack: true })')
        await pg.wait_for_timeout(500)
        check('Back lần hai đóng hộp thoại', await dialog_count(pg) == 0)
        check('console sạch (Back)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        # ── Xóa người vay nợ (kể cả khi đã có giao dịch) ─────────────────
        pg = await new_page(b, {'width': 390, 'height': 844})
        await seed(pg)
        await pg.evaluate("window.__qltc.store.put('parties', { name: 'Người thử', role: 'person' })")
        info = await pg.evaluate("""() => {
          const s = window.__qltc.store;
          const cnt = (id) => s.all('txs').filter(t => t.partyId === id).length;
          const withTx = s.all('parties').find(p => cnt(p.id) > 0);
          const lone = s.all('parties').find(p => cnt(p.id) === 0 && !s.all('deals').some(d => d.partyId === p.id));
          return { id: withTx.id, name: withTx.name, n: cnt(withTx.id), total: s.all('txs').length, loneId: lone ? lone.id : null, loneName: lone ? lone.name : null };
        }""")
        await goto(pg, 'debts/' + info['id'])
        await pg.get_by_role('button', name='Sửa').first.click()
        await pg.wait_for_timeout(500)
        check('người đã có giao dịch: nút Xóa vẫn hiện', await pg.get_by_role('button', name='Xóa', exact=True).count() == 1)
        await pg.get_by_role('button', name='Xóa', exact=True).click()
        await pg.wait_for_timeout(500)
        txt = await pg.locator('[role=dialog]').last.inner_text()
        check('hộp xác nhận nêu số giao dịch và hậu quả', f"{info['n']} giao dịch" in txt and 'Không hoàn tác' in txt and 'Vay nợ hiện tại' in txt, txt[:200])
        await pg.get_by_role('button', name='Hủy').last.click()
        await pg.wait_for_timeout(400)
        check('bấm Hủy: người vẫn còn', await pg.evaluate("window.__qltc.store.byId('parties', %r) != null" % info['id']))
        await pg.get_by_role('button', name='Xóa', exact=True).click()
        await pg.wait_for_timeout(400)
        await pg.get_by_role('button', name='Xóa cả giao dịch').click()
        await pg.wait_for_timeout(900)
        after = await pg.evaluate("""(id) => { const s = window.__qltc.store; return { has: s.byId('parties', id) != null, left: s.all('txs').filter(t => t.partyId === id).length, total: s.all('txs').length }; }""", info['id'])
        check('đã xóa người và các giao dịch của họ', not after['has'] and after['left'] == 0 and after['total'] == info['total'] - info['n'], (after, info))
        check('xóa xong quay về danh sách Vay nợ', pg.url.endswith('#/debts'), pg.url)
        page_text = await pg.evaluate("(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-sonner-toaster]').forEach(e => e.remove()); return c.textContent; })()")
        check('tên người biến mất khỏi danh sách (trừ thông báo)', info['name'] not in page_text)
        if info['loneId']:
            await goto(pg, 'debts/' + info['loneId'])
            await pg.get_by_role('button', name='Sửa').first.click()
            await pg.wait_for_timeout(400)
            await pg.get_by_role('button', name='Xóa', exact=True).click()
            await pg.wait_for_timeout(400)
            t2 = await pg.locator('[role=dialog]').last.inner_text()
            check('người chưa có giao dịch: hộp xác nhận đơn giản', 'Không hoàn tác' not in t2 and info['loneName'] in t2, t2[:120])
            await pg.get_by_role('button', name='Xóa', exact=True).last.click()
            await pg.wait_for_timeout(700)
            check('người chưa có giao dịch xóa được', not await pg.evaluate("window.__qltc.store.byId('parties', %r) != null" % info['loneId']))
        check('console sạch (xóa người)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        # ── Máy tính 1280×800 ──────────────────────────────────────────────
        pg = await new_page(b, {'width': 1280, 'height': 800}, scheme='dark')
        await seed(pg)
        check('máy tính: thanh bên hiện, thanh tab ẩn', await pg.locator('aside').is_visible() and not await pg.locator('nav[aria-label="Điều hướng chính"]').is_visible())
        await pg.keyboard.press('n')
        await pg.wait_for_timeout(500)
        check('phím N mở menu Thêm mới', await dialog_count(pg) == 1 and 'Thêm mới' in await pg.locator('[role=dialog]').inner_text())
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(400)
        await pg.locator('aside').get_by_text('Báo tỉ giá', exact=True).click()
        await pg.wait_for_timeout(500)
        check('thanh bên chuyển sang Báo tỉ giá', await pg.locator('#view h1').first.inner_text() == 'Báo tỉ giá')
        check('console sạch (máy tính)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        await b.close()
    print('\n%d lỗi' % len(FAILS))
    sys.exit(1 if FAILS else 0)


asyncio.run(main())
