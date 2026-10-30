// Slowing down repeated failed sign-ins (spec 03).
//
// Failed attempts are counted per email and per IP address in 15-minute
// windows (public.rate_limits). After 3 failures each new attempt waits a
// little longer (1 s, 2 s, ... up to 5 s); after 10 the window is locked
// until it ends. Supabase Auth has its own limits on top of these.

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_SLOWDOWN_AFTER = 3;
export const LOGIN_LOCK_AFTER = 10;
const MAX_DELAY_MS = 5000;

export function loginDelayMs(failures: number): number {
  if (failures < LOGIN_SLOWDOWN_AFTER) return 0;
  return Math.min((failures - LOGIN_SLOWDOWN_AFTER + 1) * 1000, MAX_DELAY_MS);
}

export function isLoginLocked(failures: number): boolean {
  return failures >= LOGIN_LOCK_AFTER;
}
