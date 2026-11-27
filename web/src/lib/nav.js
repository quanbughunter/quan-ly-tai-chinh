import { LayoutDashboard, ListOrdered, Briefcase, Wallet, Users, ArrowLeftRight, Building2, GraduationCap, Settings } from 'lucide-react';
import { hrefOf } from './route.js';

export const ROUTES = {
  home: { title: 'Tổng quan', icon: LayoutDashboard },
  tx: { title: 'Giao dịch', icon: ListOrdered },
  income: { title: 'Thu nhập', icon: Briefcase },
  accounts: { title: 'Tài khoản', icon: Wallet },
  debts: { title: 'Vay nợ', icon: Users },
  fx: { title: 'Báo tỉ giá', icon: ArrowLeftRight },
  dorm: { title: 'Tiền KTX', icon: Building2 },
  scholarship: { title: 'Học bổng MIIGAiK', icon: GraduationCap },
  settings: { title: 'Cài đặt', icon: Settings },
};
export const SIDE_ORDER = ['home', 'tx', 'income', 'accounts', 'debts', 'fx', 'dorm', 'scholarship', 'settings'];
export const TAB_ORDER = ['home', 'tx', 'accounts', 'debts'];
export const routeHref = (k) => hrefOf(k);
