// Chép setup/github-workflows/*.yml → .github/workflows/ (GitHub chỉ chạy workflow nằm ở đó).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'setup', 'github-workflows');
const to = path.join(root, '.github', 'workflows');

if (!fs.existsSync(from)) { console.error(`Không thấy thư mục ${from}`); process.exit(1); }
fs.mkdirSync(to, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(from).filter((x) => /\.ya?ml$/i.test(x))) {
  fs.copyFileSync(path.join(from, f), path.join(to, f));
  console.log(`Đã chép ${f} → .github/workflows/`);
  n++;
}
console.log(n ? 'Xong. Giờ commit và push để GitHub nhận workflow.' : 'Không có file workflow nào để chép.');
