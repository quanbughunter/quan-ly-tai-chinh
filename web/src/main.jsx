import { createRoot } from 'react-dom/client';
import './index.css';
import { applyTheme } from '@logic/theme.js';
import { installBackButton } from '@logic/backnav.js';
import { closeTopDialog } from '@/lib/dialogs.jsx';
import { App } from '@/app/App.jsx';

applyTheme();
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
// Mục lịch sử đầu tiên luôn là '#/': bấm tab Tổng quan khi đang ở Tổng quan không tạo thêm một bước Back "chết".
if (!location.hash) { try { history.replaceState(null, '', '#/'); } catch { /* bỏ qua */ } }
installBackButton({ closeTopModal: closeTopDialog });

// Chỉ có trong bản dựng thử (vite build --mode test): lộ kho dữ liệu và các biểu mẫu để Playwright gọi trực tiếp.
if (import.meta.env.MODE === 'test') {
  Promise.all([import('@logic/store.js'), import('@logic/demo.js'), import('@/forms/index.js'), import('@/lib/dialogs.jsx')])
    .then(([s, d, f, dl]) => { window.__qltc = { store: s.store, seedDemo: d.seedDemo, forms: f, openDialog: dl.openDialog }; });
}

createRoot(document.getElementById('root')).render(<App />);
