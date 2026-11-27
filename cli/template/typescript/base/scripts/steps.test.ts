import assert from "node:assert/strict";
import { test } from "node:test";
import { type Launched, runSteps, type Status, type Step } from "./steps.ts";

function fakeLaunch(failing: string[] = []) {
	const log: string[] = [];
	const launch = (step: Step): Launched => {
		log.push(`launch ${step.name}`);
		let go!: () => void;
		const started = new Promise<void>((resolve) => {
			go = resolve;
		});
		return {
			done: started.then(() => {
				log.push(`run ${step.name}`);
				return { ok: !failing.includes(step.name), output: `${step.name} said`, seconds: 0 };
			}),
			go,
			cancel: () => log.push(`cancel ${step.name}`),
		};
	};
	return { log, launch };
}

const states = (statuses: Map<string, Status>) =>
	Object.fromEntries([...statuses].map(([name, status]) => [name, status.state]));

test("runs each step once the steps it needs passed", async () => {
	const { log, launch } = fakeLaunch();
	const statuses = await runSteps(
		[
			{ name: "format", command: "", needs: [], format: true },
			{ name: "compile", command: "", needs: ["format"] },
			{ name: "test", command: "", needs: ["compile"] },
		],
		{ launch },
	);
	assert.deepEqual(states(statuses), { format: "passed", compile: "passed", test: "passed" });
	assert.deepEqual(log, ["launch format", "run format", "launch compile", "run compile", "launch test", "run test"]);
	assert.deepEqual(statuses.get("test"), { state: "passed", output: "test said", seconds: 0 });
});

test("a step that fails blocks what needs it, all the way down, and a warm step it blocks is cancelled", async () => {
	const { log, launch } = fakeLaunch(["format"]);
	const statuses = await runSteps(
		[
			{ name: "test", command: "", needs: ["compile"] },
			{ name: "format", command: "", needs: [] },
			{ name: "compile", command: "", needs: ["format"] },
			{ name: "lint", command: "", needs: ["format"], warm: true },
		],
		{ launch },
	);
	assert.deepEqual(states(statuses), { test: "blocked", format: "failed", compile: "blocked", lint: "blocked" });
	assert.deepEqual(statuses.get("test"), { state: "blocked", by: "compile" });
	assert.ok(log.includes("cancel lint"));
	assert.ok(!log.some((line) => /run (compile|test|lint)/.test(line)));
});

test("a step with nothing new to check is unchanged, decided once formatting passed", async () => {
	const { log, launch } = fakeLaunch();
	let formatted = false;
	const statuses = await runSteps(
		[
			{ name: "format", command: "", needs: [], format: true },
			{ name: "tooling-tests", command: "", needs: ["format"], tooling: true },
		],
		{
			launch,
			onFormatted: () => {
				formatted = true;
			},
			unchanged: (step) => (step.tooling === true && formatted ? "tooling unchanged" : undefined),
		},
	);
	assert.deepEqual(statuses.get("tooling-tests"), { state: "unchanged", why: "tooling unchanged" });
	assert.ok(!log.includes("launch tooling-tests"));
});

test("a need that names no step blocks the step, rather than leaving it waiting", async () => {
	const { launch } = fakeLaunch();
	const statuses = await runSteps([{ name: "test", command: "", needs: ["compiel"] }], { launch });
	assert.deepEqual(statuses.get("test"), { state: "blocked", by: "compiel" });
});
