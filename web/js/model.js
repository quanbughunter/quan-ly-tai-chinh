// Giá trị mặc định, nhãn tiếng Việt và danh sách loại.

export const COLLECTIONS = [
  'accounts', 'parties', 'categories', 'txs', 'deals',
  'dorm', 'scholarships', 'budgets', 'settings',
];

export const ACCOUNT_KINDS = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  card: 'Thẻ',
  ewallet: 'Ví điện tử',
  savings: 'Tiết kiệm / gửi người thân',
  crypto: 'Crypto',
};

export const TX_KINDS = {
  income: 'Thu',
  expense: 'Chi',
  transfer: 'Chuyển / đổi tiền',
  lend: 'Cho vay',
  repay_in: 'Được trả nợ',
  borrow: 'Đi vay',
  repay_out: 'Trả nợ',
  adjust: 'Điều chỉnh số dư',
};

export const PARTY_ROLES = {
  person: 'Người quen / vay mượn',
  customer: 'Khách đổi tiền',
  family: 'Người nhà',
};

export const DEFAULT_CATEGORIES = [
  { name: 'Ăn uống', type: 'expense', icon: '🍜' },
  { name: 'Đi lại', type: 'expense', icon: '🚌' },
  { name: 'Nhà ở / KTX', type: 'expense', icon: '🏠' },
  { name: 'Học tập', type: 'expense', icon: '📚' },
  { name: 'Biếu gia đình', type: 'expense', icon: '🎁' },
  { name: 'Sức khỏe', type: 'expense', icon: '💊' },
  { name: 'Mua sắm', type: 'expense', icon: '🛍️' },
  { name: 'Du lịch / giải trí', type: 'expense', icon: '🎈' },
  { name: 'Phí & dịch vụ', type: 'expense', icon: '🧾' },
  { name: 'Chi khác', type: 'expense', icon: '✨' },
  { name: 'Lương', type: 'income', icon: '💼' },
  { name: 'Học bổng', type: 'income', icon: '🎓' },
  { name: 'Sinh hoạt phí', type: 'income', icon: '🏦' },
  { name: 'Kinh doanh đổi tiền', type: 'income', icon: '💱' },
  { name: 'Thu khác', type: 'income', icon: '🌱' },
];

export const DEFAULT_SETTINGS = {
  baseCurrency: 'VND',
  // 1 đơn vị ngoại tệ = bao nhiêu VND (chỉ dùng để quy đổi tổng quan)
  rates: { RUB: 300, USD: 26000, USDT: 26500 },
  params: {
    lotSang: 1200000, // VND: cỡ lô chuẩn của chiều "sang"
    lotVe: 5000, // RUB: cỡ lô chuẩn của chiều "về"
    refVnd: 23100000, // VND tham chiếu để quy ra RUB
    defaultMarginSang: 90000, // VND lãi mong muốn trên mỗi lô
    defaultMarginVe: 90000,
    dealAccountId: '', // tài khoản (thẻ MB) nhận lãi khi chốt giao dịch đổi tiền; để trống = hỏi lúc chốt
    scholarshipAmount: 15000, // RUB: học bổng MIIGAiK mỗi tháng
    scholarshipAccountId: '', // thẻ ₽ nhận học bổng lần gần nhất (tự nhớ); để trống = Gazprom → PSPB → thẻ ₽ đầu tiên
  },
  hideAmounts: false,
};

export const COLORS = ['#7aa2f7', '#f7a8b8', '#9ad9b3', '#f6c177', '#b4a7f5', '#7fd1d9', '#f2a97c', '#c3d97b'];

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // dự phòng cho môi trường cũ / test
  const h = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}
