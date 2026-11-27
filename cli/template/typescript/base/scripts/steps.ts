export interface Step {
	name: string;
	command: string;
	needs: string[];
	fixCommand?: string;
	/** A formatter: once every one passed, the files are as the rest of the check sees them. */
	format?: boolean;
	/** Checks the project's own tooling, which can be unchanged since it last passed. */
	tooling?: boolean;
	/** Started with the check, so it loads while the steps it needs run; it waits for `go()`. */
	warm?: boolean;
}

export interface Finished {
	ok: boolean;
	output: string;
	seconds: number;
}

export interface Launched {
	done: Promise<Finished>;
	go: () => void;
	cancel: () => void;
}

/**
 * Where a step is. It waits for the steps it needs, then runs, unless one of them didn't pass
 * (blocked) or it has nothing new to check (unchanged).
 */
export type Status =
	| { state: "waiting"; launched?: Launched }
	| { state: "running" }
	| { state: "passed" | "failed"; output: string; seconds: number }
	| { state: "blocked"; by: string }
	| { state: "unchanged"; why: string };

export interface Schedule {
	launch: (step: Step) => Launched;
	/** Why a step that could run now has nothing to check, if it hasn't. */
	unchanged?: (step: Step) => string | undefined;
	/** Called once, when every format step has passed. */
	onFormatted?: () => void;
}

const settled = (status: Status | undefined) => status?.state !== "waiting" && status?.state !== "running";
const passed = (status: Status | undefined) => status?.state === "passed" || status?.state === "unchanged";

/** Runs the steps, each as soon as the steps it needs have passed, and returns where each ended. */
export function runSteps(steps: Step[], schedule: Schedule): Promise<Map<string, Status>> {
	const statuses = new Map<string, Status>(
		steps.map((step) => [
			step.name,
			{ state: "waiting", launched: step.warm === true ? schedule.launch(step) : undefined },
		]),
	);
	let formatted = false;
	return new Promise((finish) => {
		const advance = () => {
			let moved = true;
			while (moved) {
				moved = false;
				for (const step of steps) {
					const status = statuses.get(step.name);
					if (status?.state !== "waiting") continue;
					const unmet = step.needs.find((need) => settled(statuses.get(need)) && !passed(statuses.get(need)));
					if (unmet !== undefined) {
						status.launched?.cancel();
						statuses.set(step.name, { state: "blocked", by: unmet });
						moved = true;
						continue;
					}
					if (!step.needs.every((need) => passed(statuses.get(need)))) continue;
					const why = schedule.unchanged?.(step);
					if (why !== undefined) {
						status.launched?.cancel();
						statuses.set(step.name, { state: "unchanged", why });
						moved = true;
						continue;
					}
					const launched = status.launched ?? schedule.launch(step);
					statuses.set(step.name, { state: "running" });
					launched.go();
					void launched.done.then(({ ok, output, seconds }) => {
						statuses.set(step.name, { state: ok ? "passed" : "failed", output, seconds });
						if (!formatted && steps.every((one) => one.format !== true || statuses.get(one.name)?.state === "passed")) {
							formatted = true;
							schedule.onFormatted?.();
						}
						advance();
					});
				}
			}
			if ([...statuses.values()].every(settled)) finish(statuses);
		};
		advance();
	});
}
