import { expect, it, vi } from 'vitest';
import { inboxDateParts } from '../src/features/inbox/inboxDateParts';
it('keeps local date and time consistent across UTC midnight', () => {
  const captured = new Date('2026-10-29T16:30:00Z');
  vi.spyOn(captured, 'getFullYear').mockReturnValue(2026);
  vi.spyOn(captured, 'getMonth').mockReturnValue(9);
  vi.spyOn(captured, 'getDate').mockReturnValue(30);
  vi.spyOn(captured, 'getHours').mockReturnValue(0);
  vi.spyOn(captured, 'getMinutes').mockReturnValue(30);
  vi.spyOn(captured, 'toTimeString').mockReturnValue('00:30:00 GMT+0700');
  expect(inboxDateParts(captured)).toEqual({ date: '2026-10-30', time: '00:30' });
});
