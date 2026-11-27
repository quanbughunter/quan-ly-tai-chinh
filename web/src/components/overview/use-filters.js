import { useReducer } from 'react';

/**
 * Bộ lọc giữ nguyên khi chuyển màn hình rồi quay lại: object F nằm ở cấp module (do màn hình tạo),
 * hook này chỉ cho phép sửa nó và vẽ lại màn hình.
 */
export function useFilters(F) {
  const [, force] = useReducer((x) => x + 1, 0);
  const set = (patch) => { Object.assign(F, patch); force(); };
  return [F, set];
}
