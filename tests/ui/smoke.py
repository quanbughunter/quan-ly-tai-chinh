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


async def open_view(b, frag, vp=None, scheme='light'):
    """Mở trang xem bảng công nợ (share.html) với phần #… của link, trên máy chủ thử."""
    ctx = await b.new_context(viewport=vp or {'width': 390, 'height': 844}, color_scheme=scheme, device_scale_factor=1)
    pg = await ctx.new_page()
    pg.logs = []
    pg.on('console', lambda m: pg.logs.append(m.text[:300]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: pg.logs.append('ERR ' + str(e)))
    await pg.goto(URL.rstrip('/') + '/share.html' + frag)
    await pg.wait_for_timeout(600)
    return pg


def parse_money(txt):
    import re
    return float(re.sub(r'[^\d,]', '', txt).replace(',', '.'))


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

        # ── Máy tính trong ô nhập tiền (+ − × ÷ ( ), k / tr, bàn phím) ─────
        pg = await new_page(b, {'width': 390, 'height': 844})
        await seed(pg)
        await goto(pg, '')
        await pg.evaluate("window.__qltc.forms.openTxForm({ group: 'expense' })")
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        inp = d.locator('input[placeholder="0"]').first
        await inp.fill('45k*3')
        check('gõ 45k*3 hiện = 135.000 ₫', '= 135.000 ₫' in await d.inner_text())
        await inp.fill('2tr/3')
        check('2tr/3 làm tròn đồng: = 666.667 ₫', '= 666.667 ₫' in await d.inner_text())
        await inp.fill('(2tr+500k)/5')
        check('ngoặc: (2tr+500k)/5 = 500.000 ₫', '= 500.000 ₫' in await d.inner_text())
        await inp.fill('12+x')
        check('biểu thức sai báo không đọc được', 'Không đọc được số tiền' in await d.inner_text())
        await inp.fill('')
        await d.get_by_test_id('calc-toggle').first.click()
        await pg.wait_for_timeout(250)
        pad = d.get_by_test_id('calc-pad').first
        check('nút máy tính mở bàn phím', await pad.count() == 1 and await inp.get_attribute('inputmode') == 'none')
        for k in ['4', '5', 'k', '×', '3']:
            await pad.locator(f'[data-key="{k}"]').click()
        check('bấm 4 5 k × 3 ra "45k×3" và = 135.000 ₫', await inp.input_value() == '45k×3' and '= 135.000 ₫' in await d.inner_text(), await inp.input_value())
        await pad.locator('[data-key="="]').click()
        check('phím = đổi biểu thức thành số 135000', await inp.input_value() == '135000')
        await pad.locator('[data-key="clear"]').click()
        for k in ['2', 'tr', '+', '5', '0', '0', 'k']:
            await pad.locator(f'[data-key="{k}"]').click()
        check('2tr + 500k = 2.500.000 ₫', '= 2.500.000 ₫' in await d.inner_text())
        await pad.locator('[data-key="done"]').click()
        check('Xong đóng bàn phím', await d.get_by_test_id('calc-pad').count() == 0)
        await inp.fill('45k*3')
        before = await txs(pg)
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(700)
        new = [t for t in await txs(pg) if t['id'] not in {x['id'] for x in before}]
        check('lưu 45k*3 thành khoản 135.000', len(new) == 1 and new[0]['amount'] == 135000, new)

        # Nhập nhanh: gõ nhân/chia trong ô văn bản + nút Máy tính chèn kết quả
        await pg.evaluate("window.__qltc.forms.openQuickAdd('')")
        await pg.wait_for_timeout(500)
        d = pg.locator('[role=dialog]').last
        await d.locator('textarea').fill('cafe 25k*2, ăn tối 450k/3; bia 35k x 4')
        await pg.wait_for_timeout(300)
        amts = await pg.evaluate("[...document.querySelectorAll('[data-testid=qa-item] strong')].map(e => e.textContent)")
        check('Nhập nhanh đọc 25k*2, 450k/3, 35k x 4', amts == ['50.000 ₫', '150.000 ₫', '140.000 ₫'], amts)
        await d.locator('textarea').fill('cafe ')
        await d.get_by_role('button', name='Máy tính').click()
        await pg.wait_for_timeout(250)
        qpad = d.get_by_test_id('qa-calc').get_by_test_id('calc-pad')
        for k in ['4', '5', '0', 'k', '÷', '3']:
            await qpad.locator(f'[data-key="{k}"]').click()
        await qpad.locator('[data-key="done"]').click()
        await pg.wait_for_timeout(250)
        check('Chèn 450k÷3 vào cuối ô: "cafe 150000"', await d.locator('textarea').input_value() == 'cafe 150000')
        # dòng chia nợ: bàn phím máy tính ở ô "Phần của …"
        await d.locator('textarea').fill('ăn tối 450k')
        await pg.wait_for_timeout(250)
        await d.get_by_text('Cộng nợ', exact=True).first.click()
        await pg.wait_for_timeout(300)
        await d.get_by_role('checkbox').first.click()
        await pg.wait_for_timeout(250)
        row_inp = d.locator('input[aria-label^="Phần của"]').first
        sh = row_inp.locator('xpath=ancestor::div[contains(@class,"grid")][1]')
        await sh.get_by_test_id('calc-toggle').click()
        await pg.wait_for_timeout(250)
        rpad = sh.get_by_test_id('calc-pad')
        await rpad.locator('[data-key="clear"]').click()
        for k in ['4', '5', '0', 'k', '÷', '3', '=']:
            await rpad.locator(f'[data-key="{k}"]').click()
        check('ô Phần của người: 450k÷3 → 150000', await row_inp.input_value() == '150000', await row_inp.input_value())
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(300)

        # Cài đặt: ô tự lưu khi đóng bàn phím
        await goto(pg, 'settings')
        await pg.wait_for_timeout(500)
        lot = pg.locator('div[data-slot=field]', has_text='Cỡ lô chiều “Sang”').first
        await lot.get_by_test_id('calc-toggle').click()
        await pg.wait_for_timeout(250)
        lpad = lot.get_by_test_id('calc-pad')
        await lpad.locator('[data-key="clear"]').click()
        for k in ['2', '0', 'tr', '×', '1', '0', '=', 'done']:
            await lpad.locator(f'[data-key="{k}"]').click()
        await pg.wait_for_timeout(600)
        check('cài đặt: đóng bàn phím tự lưu 20tr×10 = 200.000.000', '200000000' in await pg.evaluate("JSON.stringify(window.__qltc.store.settings())"))
        check('console sạch (máy tính)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        # ── Chia nợ (Cộng nợ / Trừ nợ) trong form Thêm giao dịch: nút Thêm ở tab Giao dịch + nút "+" ──
        pg = await new_page(b, {'width': 390, 'height': 844})
        await seed(pg)
        await goto(pg, 'tx')
        await pg.get_by_role('button', name='Thêm', exact=True).first.click()
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        check('tab Giao dịch → Thêm: có khối chia nợ', await d.get_by_test_id('tx-share').count() == 1)
        check('mặc định là Không chia, chưa hiện danh sách người', await d.get_by_role('checkbox').count() == 0)
        before = await txs(pg)
        await d.locator('input[placeholder="0"]').first.fill('450k')
        await d.get_by_test_id('tx-share').get_by_text('Cộng nợ', exact=True).click()
        await pg.wait_for_timeout(300)
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(400)
        check('Cộng nợ chưa chọn ai: không lưu, hộp thoại còn mở', await dialog_count(pg) == 1 and len(await txs(pg)) == len(before))
        chips = d.get_by_test_id('tx-share').get_by_role('checkbox')
        names = []
        for i in range(2):
            names.append((await chips.nth(i).inner_text()).strip())
            await chips.nth(i).click()
            await pg.wait_for_timeout(150)
        await pg.wait_for_timeout(250)
        await pg.screenshot(path='/tmp/shots/tx-share-add.png')
        txt = await d.inner_text()
        check('tóm tắt chia 3 phần (2 người + mình) = 150.000 ₫', txt.count('150.000 ₫') >= 2 and 'Tài khoản −450.000 ₫' in txt, txt[-400:])
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(700)
        ids = {x['id'] for x in before}
        new = [t for t in await txs(pg) if t['id'] not in ids]
        kinds = sorted(t['kind'] for t in new)
        check('Cộng nợ ghi 2 khoản cho vay + 1 khoản chi phần mình', kinds == ['expense', 'lend', 'lend'], kinds)
        check('tổng các phần = 450.000 và cùng một tài khoản', sum(t['amount'] for t in new) == 450000 and len({t['accountId'] for t in new}) == 1, new)
        check('đóng hộp thoại sau khi lưu', await dialog_count(pg) == 0)

        # Nút "+" nổi → Khoản chi → Trừ nợ
        await goto(pg, '')
        await pg.get_by_label('Thêm giao dịch').first.click()
        await pg.wait_for_timeout(400)
        await pg.get_by_text('Khoản chi', exact=True).click()
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        check('nút "+" → Khoản chi: có khối chia nợ', await d.get_by_test_id('tx-share').count() == 1)
        check('chưa chia: có ô Danh mục', await d.get_by_text('Danh mục', exact=True).count() == 1)
        before = await txs(pg)
        await d.locator('input[placeholder="0"]').first.fill('300k')
        await d.get_by_test_id('tx-share').get_by_text('Trừ nợ', exact=True).click()
        await pg.wait_for_timeout(300)
        check('Trừ nợ: ẩn ô Danh mục', await d.get_by_text('Danh mục', exact=True).count() == 0)
        await d.get_by_test_id('tx-share').get_by_role('checkbox').first.click()
        await pg.wait_for_timeout(250)
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(700)
        ids = {x['id'] for x in before}
        new = [t for t in await txs(pg) if t['id'] not in ids]
        check('Trừ nợ ghi 1 khoản "Thu nợ" đủ 300.000', len(new) == 1 and new[0]['kind'] == 'repay_in' and new[0]['amount'] == 300000, new)

        # Khoản chi thường (không chia) vẫn lưu đúng 1 giao dịch; Thu / sửa giao dịch cũ không có khối chia nợ
        await goto(pg, 'tx')
        await pg.get_by_role('button', name='Thêm', exact=True).first.click()
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        before = await txs(pg)
        await d.locator('input[placeholder="0"]').first.fill('25k')
        await d.get_by_role('button', name='Lưu').last.click()
        await pg.wait_for_timeout(600)
        ids = {x['id'] for x in before}
        new = [t for t in await txs(pg) if t['id'] not in ids]
        check('Không chia: vẫn lưu đúng 1 giao dịch', len(new) == 1 and new[0]['kind'] == 'expense' and new[0]['amount'] == 25000, new)
        await pg.get_by_role('button', name='Thêm', exact=True).first.click()
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        await d.get_by_text('Thu', exact=True).first.click()
        await pg.wait_for_timeout(300)
        check('nhóm Thu: không có khối chia nợ', await d.get_by_test_id('tx-share').count() == 0)
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(300)
        await pg.evaluate("window.__qltc.forms.openTxForm({ tx: window.__qltc.store.all('txs').find(t => t.kind === 'expense' && !t.dealId && !t.scholarshipId) })")
        await pg.wait_for_timeout(600)
        d = pg.locator('[role=dialog]').last
        check('sửa giao dịch cũ: không có khối chia nợ', 'Sửa giao dịch' in await d.inner_text() and await d.get_by_test_id('tx-share').count() == 0)
        check('console sạch (chia nợ trong form giao dịch)', not pg.logs, pg.logs[:3])
        await pg.context.close()

        # ── Gửi bảng nợ: tạo link ở trang người vay nợ → mở trang xem ──────────
        pg = await new_page(b, {'width': 390, 'height': 844})
        await seed(pg)
        await pg.evaluate("window.__qltc.store.put('parties', { name: 'Người chưa nợ', role: 'person' })")
        info = await pg.evaluate("""() => {
          const s = window.__qltc.store; const K = ['lend', 'repay_in', 'borrow', 'repay_out'];
          const SIGN = { lend: 1, repay_in: -1, borrow: -1, repay_out: 1 };
          const debtTxs = (id) => s.all('txs').filter(t => t.partyId === id && K.includes(t.kind));
          const p = s.all('parties').find(x => debtTxs(x.id).length > 0);
          const none = s.all('parties').find(x => debtTxs(x.id).length === 0);
          const bal = {}; for (const t of debtTxs(p.id)) bal[t.currency] = (bal[t.currency] || 0) + SIGN[t.kind] * t.amount;
          const dates = debtTxs(p.id).map(t => t.date).sort();
          return { id: p.id, name: p.name, n: debtTxs(p.id).length, bal, last: dates[dates.length - 1], noneId: none ? none.id : null };
        }""")
        await goto(pg, 'debts/' + info['id'])
        await pg.get_by_role('button', name='Gửi bảng nợ').click()
        await pg.wait_for_timeout(700)
        d = pg.locator('[role=dialog]').last
        check('hộp Gửi bảng nợ mở, có tên người nhận', f"Gửi bảng nợ cho {info['name']}" in await d.inner_text())
        pv = await d.get_by_test_id('share-preview').inner_text()
        check('xem trước nêu số dòng', f"{info['n']} dòng" in pv, pv)
        link_in = d.get_by_test_id('share-link')
        await pg.wait_for_function("document.querySelector('[data-testid=share-link]').value.includes('share.html#v1.')")
        link0 = await link_in.input_value()
        check('link trỏ tới share.html#v1.… (đã nén, ngắn)', '/share.html#v1.' in link0 and len(link0) < 3000, len(link0))
        await d.locator('input[placeholder="Ví dụ: Quân"]').fill('Quân')
        await d.locator('textarea').fill('STK 0123456789 - NGUYEN VAN A')
        await pg.wait_for_timeout(500)
        link = await link_in.input_value()
        check('đổi tên / ghi chú thì link đổi theo', link != link0)
        await d.get_by_test_id('share-copy').click()
        await pg.wait_for_timeout(500)
        check('bấm Sao chép có báo', 'sao chép' in (await pg.locator('[data-sonner-toaster]').inner_text()).lower())
        await pg.screenshot(path='/tmp/shots/share-dialog.png')

        # trang người nhận mở bằng đúng link đó
        v = await open_view(b, link[link.index('#'):])
        check('trang xem: tiêu đề nêu tên người gửi', await v.locator('h1').inner_text() == 'Công nợ giữa bạn và Quân')
        rows = await v.locator('tbody tr:not(.open)').count()
        check('trang xem: đủ số dòng giao dịch', rows == info['n'], (rows, info['n']))
        bigs = [parse_money(t) for t in await v.locator('.sum .big').all_inner_texts()]
        want = sorted(round(abs(x), 2) for x in info['bal'].values() if abs(x) > 1e-9)
        check('trang xem: số còn nợ khớp màn hình Vay nợ', sorted(round(x, 2) for x in bigs) == want, (bigs, want))
        check('trang xem: có khung ghi chú kèm', 'STK 0123456789' in await v.locator('.note').inner_text())
        check('trang xem: không tràn ngang trên điện thoại', await v.evaluate('document.documentElement.scrollWidth') <= 390)
        await v.screenshot(path='/tmp/shots/share-view.png', full_page=True)
        check('trang xem: console sạch', not v.logs, v.logs[:3])
        await v.context.close()

        # liệt kê từ ngày: phần trước gộp thành số dư đầu kỳ, tổng vẫn như cũ
        await d.locator('input[type=date]').fill(info['last'])
        await pg.wait_for_timeout(500)
        link2 = await link_in.input_value()
        v = await open_view(b, link2[link2.index('#'):])
        txt = await v.locator('#app').inner_text()
        check('lọc từ ngày: có số dư đầu kỳ và mốc ngày', 'Số dư đầu kỳ' in txt and 'Liệt kê từ ngày' in txt)
        bigs2 = sorted(round(parse_money(t), 2) for t in await v.locator('.sum .big').all_inner_texts())
        check('lọc từ ngày: tổng còn nợ không đổi', bigs2 == want, (bigs2, want))
        await v.context.close()

        # nội dung xấu trong link chỉ hiện thành chữ, không chạy
        await d.locator('input[placeholder="Ví dụ: Quân"]').fill('<img src=x onerror=alert(1)>')
        await d.locator('textarea').fill('<b>đậm</b> <script>alert(2)</script>')
        await pg.wait_for_timeout(500)
        link3 = await link_in.input_value()
        v = await open_view(b, link3[link3.index('#'):])
        check('chữ lạ trong link hiện nguyên văn', '<img src=x onerror=alert(1)>' in await v.locator('h1').inner_text() and '<b>đậm</b>' in await v.locator('.note p').inner_text())
        check('chữ lạ không tạo thẻ mới', await v.evaluate("document.querySelectorAll('img, .note p b, .note p script').length") == 0)
        await v.context.close()

        # link hỏng / trống
        v = await open_view(b, '#v1.AAAA')
        check('link hỏng: báo không đọc được', 'Không đọc được link' in await v.locator('#app').inner_text())
        await v.context.close()
        v = await open_view(b, '')
        check('không có dữ liệu: báo chưa có dữ liệu', 'Chưa có dữ liệu' in await v.locator('#app').inner_text())
        await v.context.close()

        # người chưa có giao dịch nợ: nút bị khóa
        await pg.keyboard.press('Escape')
        await pg.wait_for_timeout(400)
        if info['noneId']:
            await goto(pg, 'debts/' + info['noneId'])
            check('người chưa có giao dịch nợ: nút Gửi bảng nợ bị khóa', await pg.get_by_role('button', name='Gửi bảng nợ').is_disabled())
        check('console sạch (Gửi bảng nợ)', not pg.logs, pg.logs[:3])
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
