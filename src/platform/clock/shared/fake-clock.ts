import { type Clock } from "./clock";

/** A clock for tests: it stands still until `advance` moves it. */
export class FakeClock implements Clock {
	constructor(private time = 0) {}

	now() {
		return this.time;
	}

	advance(seconds: number) {
		this.time += seconds;
	}
}
