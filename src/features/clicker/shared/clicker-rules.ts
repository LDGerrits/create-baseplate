export const CLICK_COOLDOWN_SECONDS = 0.1;

/** Whether a player who last clicked at `lastClickAt` may click again at `now` (both `os.clock()` seconds). */
export function canClick(lastClickAt: number | undefined, now: number): boolean {
	return lastClickAt === undefined || now - lastClickAt >= CLICK_COOLDOWN_SECONDS;
}
