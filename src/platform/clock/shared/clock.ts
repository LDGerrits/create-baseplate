/** The time, as an interface so a test can set it. Game code reads time through a `Clock`. */
export interface Clock {
	/** Seconds since an arbitrary start, like `os.clock()`. */
	now(): number;
}

/** The real clock. The app registers it for Flamework in each `main` file. */
export const systemClock: Clock = {
	now() {
		return os.clock();
	},
};
