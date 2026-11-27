import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Gộp class Tailwind, class sau thắng class trước. */
export const cn = (...inputs) => twMerge(clsx(inputs));
