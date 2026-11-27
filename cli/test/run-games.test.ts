import assert from "node:assert/strict";
import { test } from "node:test";
import {
	checkGame,
	type EditHookProbe,
	editHookFailure,
	isInfrastructureFailure,
	lastJson,
	type Outcome,
	runBatch,
	runEngine,
	type Steps,
	summarise,
	withRetry,
} from "../../.github/scripts/run-games.ts";

const quietly = async <T>(body: () => Promise<T>): Promise<{ result: T; log: string }> => {
	const lines: string[] = [];
	const original = console.log;
	console.log = (...args: unknown[]) => void lines.push(args.join(" "));
	try {
		return { result: await body(), log: lines.join("\n") };
	} finally {
		console.log = original;
	}
};

function fakeSteps(options: {
	create?: (flags: string) => { code: number | null; committed?: boolean; checked?: boolean; created?: boolean };
	exits?: (args: string[], dir: string) => number | null;
	hooks?: string;
}): Steps & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		create: async (flags) => {
			calls.push(`create ${flags}`);
			const { code, committed, checked = committed, created } = options.create?.(flags) ?? { code: 0, committed: true };
			return { code, result: committed === undefined ? undefined : { committed, checked, created } };
		},
		mise: async (args, dir) => {
			calls.push(`mise ${args.join(" ")} in ${dir.split("/").slice(-3).join("/")}`);
			return options.exits?.(args, dir) ?? 0;
		},
		hooksPath: async () => options.hooks ?? ".githooks",
		applyCorpus: (dir, language) => void calls.push(`corpus ${language} in ${dir.split("/").slice(-2).join("/")}`),
	};
}

const batch = (games: string[], template = false) => ({
	name: "typescript 1/1",
	language: "typescript" as const,
	games,
	template,
});

test("a game committed with its hook is checked once, by the hook", async () => {
	const steps = fakeSteps({});
	const { result } = await quietly(() => checkGame("--ui vide", "/g/0/coin-rush", steps));
	assert.equal(result.failure, undefined);
	assert.deepEqual(steps.calls, ["create --ui vide"], "no second mise run ci");
});

test("a game left uncommitted is checked after it is created, and a release game is released", async () => {
	const steps = fakeSteps({ create: () => ({ code: 0, committed: false }) });
	const { result } = await quietly(() => checkGame("--release darklua", "/g/0/coin-rush", steps));
	assert.equal(result.failure, undefined);
	assert.deepEqual(
		steps.calls.map((call) => call.replace(/ in .*/, "")),
		["create --release darklua", "mise run ci", "mise run release"],
	);
});

test("a game committed before its hooks were set up is checked after it is created", async () => {
	const steps = fakeSteps({ create: () => ({ code: 0, committed: true, checked: false }) });
	const { result } = await quietly(() => checkGame("", "/g/0/coin-rush", steps));
	assert.equal(result.failure, undefined);
	assert.deepEqual(
		steps.calls.map((call) => call.replace(/ in .*/, "")),
		["create ", "mise run ci"],
	);
});

test("a first commit that ran no hook is a failure, since nothing checked the game", async () => {
	const steps = fakeSteps({ hooks: "" });
	const { result } = await quietly(() => checkGame("", "/g/0/coin-rush", steps));
	assert.match(result.failure ?? "", /didn't run the game's commit hook/);
});

test("a game that can't be created, or whose check or release fails, says which step", async () => {
	const created = await quietly(() => checkGame("", "/d", fakeSteps({ create: () => ({ code: 1 }) })));
	assert.match(created.result.failure ?? "", /creating the game failed \(exit 1\)/);
	const commit = await quietly(() =>
		checkGame("", "/d", fakeSteps({ create: () => ({ code: 1, committed: false, created: true }) })),
	);
	assert.match(commit.result.failure ?? "", /first commit failed, so the game's check did/);
	const unrun = await quietly(() => checkGame("", "/d", fakeSteps({ create: () => ({ code: null }) })));
	assert.match(unrun.result.failure ?? "", /creating the game failed;/);
	const checked = await quietly(() =>
		checkGame("", "/d", fakeSteps({ create: () => ({ code: 0, committed: false }), exits: () => 2 })),
	);
	assert.match(checked.result.failure ?? "", /mise run ci failed \(exit 2\)/);
	const released = await quietly(() =>
		checkGame("--release darklua", "/d", fakeSteps({ exits: (args) => (args[1] === "release" ? 1 : 0) })),
	);
	assert.match(released.result.failure ?? "", /mise run release failed/);
});

test("a failing game doesn't hide the games after it, and the batch fails", async () => {
	const steps = fakeSteps({ create: (flags) => ({ code: flags === "--data lapis" ? 1 : 0, committed: true }) });
	const { result, log } = await quietly(() => runBatch(batch(["", "--data lapis", "--ui vide"]), "/g", steps, "/t"));
	assert.equal(result, 1);
	assert.deepEqual(steps.calls, ["create ", "create --data lapis", "create --ui vide"]);
	assert.match(log, /::group::\(no add-ons\)/);
	assert.match(log, /::group::--data lapis/);
	assert.match(log, /Games in typescript 1\/1: 2 of 3 passed/);
	assert.match(log, /FAILED .* --data lapis/);
	assert.match(log, /::error title=--data lapis::creating the game failed \(exit 1\)/);
	assert.equal((log.match(/::endgroup::/g) ?? []).length, 3);
});

test("a batch of passing games passes, and the first batch checks its template first", async () => {
	const steps = fakeSteps({});
	const { result, log } = await quietly(() => runBatch(batch(["", "--ui vide"], true), "/g", steps, "/t"));
	assert.equal(result, 0);
	assert.deepEqual(steps.calls, [
		"mise trust --quiet in t/typescript/base",
		"mise install in t/typescript/base",
		"mise run install in t/typescript/base",
		"mise run ci in t/typescript/base",
		"create --language typescript",
		"corpus typescript in corpus/coin-rush",
		"mise run ci in g/corpus/coin-rush",
		"create ",
		"create --ui vide",
	]);
	assert.match(log, /4 of 4 passed/);
});

test("a failing template fails the batch but the games still run", async () => {
	const steps = fakeSteps({ exits: (args) => (args[1] === "ci" ? 1 : 0) });
	const { result, log } = await quietly(() => runBatch(batch([""], true), "/g", steps, "/t"));
	assert.equal(result, 1);
	assert.deepEqual(steps.calls.at(-1), "create ");
	assert.match(log, /::error title=template typescript::mise run ci failed/);
});

test("a corpus the check rejects fails the batch, and says so", async () => {
	const steps = fakeSteps({ exits: (args, dir) => (args[1] === "ci" && dir.includes("corpus") ? 1 : 0) });
	const { result, log } = await quietly(() => runBatch(batch([""], true), "/g", steps, "/t"));
	assert.equal(result, 1);
	assert.match(log, /::error title=corpus typescript::mise run ci failed on the corpus/);
});

test("the summary names each game, and marks failures", () => {
	const { markdown, text } = summarise("Games", [
		{ name: "(no add-ons)", seconds: 7.5, note: "checked in the first commit" },
		{ name: "--data lapis", seconds: 3, failure: "mise run ci failed (exit 1)\nmore" },
	]);
	assert.match(text, /^Games: 1 of 2 passed/);
	assert.match(markdown, /\| ❌ \| `--data lapis` \| 3\.0 \| mise run ci failed \(exit 1\) \|/);
	assert.match(markdown, /\| ✅ \| `\(no add-ons\)` \| 7\.5 \| checked in the first commit \|/);
});

test("reads the CLI's JSON result from the last JSON line", () => {
	assert.deepEqual(lastJson('noise\n{"ok":false}\n{"ok":true,"committed":true}\n'), { ok: true, committed: true });
	assert.equal(lastJson("no json"), undefined);
	assert.equal(lastJson("{broken"), undefined);
});

const ESC = String.fromCharCode(27);
const infra = `${ESC}[41m Roblox Infrastructure Error ${ESC}[49m\nExecution timed out: Roblox never reported a terminal state`;
const outage = " Backend Error \n  Caused by:\n    [0] ApiError: HTTP 503 UNAVAILABLE";

test("tells Roblox's own failures from a spec's", () => {
	assert.equal(isInfrastructureFailure(3, infra), true);
	assert.equal(isInfrastructureFailure(2, outage), true);
	assert.equal(isInfrastructureFailure(2, " Backend Error \n [0] NetworkError: fetch failed"), true);
	assert.equal(isInfrastructureFailure(2, " Backend Error \n [0] PollTimeoutError: gave up"), true);
	assert.equal(isInfrastructureFailure(2, " Backend Error \n [0] ApiError: HTTP 403 Forbidden"), false);
	assert.equal(isInfrastructureFailure(2, " Backend Error \n [0] ApiError: HTTP 404 Not Found"), false);
	assert.equal(isInfrastructureFailure(2, " Config Error \n bad"), false);
	assert.equal(isInfrastructureFailure(3, " Missing Gap Record \n x"), false);
	assert.equal(isInfrastructureFailure(1, `${infra}\n${outage}\n× HTTP 503 in a test`), false);
	assert.equal(isInfrastructureFailure(0, infra), false);
	assert.equal(isInfrastructureFailure(null, infra), false);
});

const outcome = (code: number | null, output = ""): Outcome => ({ code, stdout: "", output });

test("runs again once when the outcome is retryable, and not otherwise", async () => {
	const outcomes = [outcome(3, infra), outcome(0)];
	const retries: number[] = [];
	const { outcome: last, retried } = await withRetry(
		async () => outcomes.shift() ?? outcome(9),
		(o) => isInfrastructureFailure(o.code, o.output),
		{ retries: 1, delayMs: 0, onRetry: (o) => void retries.push(o.code ?? -1) },
	);
	assert.deepEqual([last.code, retried, retries], [0, 1, [3]]);

	let calls = 0;
	const failing = await withRetry(
		async () => (calls++, outcome(1, "× a spec failed")),
		(o) => isInfrastructureFailure(o.code, o.output),
		{ retries: 1, delayMs: 0, onRetry: () => assert.fail("retried a spec") },
	);
	assert.deepEqual([failing.outcome.code, calls], [1, 1]);

	calls = 0;
	const twice = await withRetry(
		async () => (calls++, outcome(3, infra)),
		(o) => isInfrastructureFailure(o.code, o.output),
		{
			retries: 1,
			delayMs: 0,
			onRetry: () => {},
		},
	);
	assert.deepEqual([twice.outcome.code, calls], [3, 2]);
});

test("the engine run retries a set that failed on Roblox's side, once, and reports it", async () => {
	const results = new Map([["/g/0/coin-rush", [outcome(2, outage), outcome(0)]]]);
	const ran: string[] = [];
	const { result, log } = await quietly(() =>
		runEngine(
			["", "--language luau"],
			"/g",
			async (dir) => {
				ran.push(dir);
				return results.get(dir)?.shift() ?? outcome(0);
			},
			0,
		),
	);
	assert.equal(result, 0);
	assert.deepEqual(ran, ["/g/0/coin-rush", "/g/0/coin-rush", "/g/1/coin-rush"]);
	assert.match(log, /::warning title=\(no add-ons\)::Roblox's side failed/);
	assert.match(log, /passed on the second try/);
});

test("the engine run doesn't retry a failing spec, and goes on to the next game", async () => {
	const ran: string[] = [];
	const { result, log } = await quietly(() =>
		runEngine(
			["", "--ui vide"],
			"/g",
			async (dir) => {
				ran.push(dir);
				return dir.includes("/0/") ? outcome(1, "× spec failed") : outcome(0);
			},
			0,
		),
	);
	assert.equal(result, 1);
	assert.deepEqual(ran, ["/g/0/coin-rush", "/g/1/coin-rush"]);
	assert.match(log, /::error title=\(no add-ons\)::the specs failed \(exit 1\)/);
});

test("when Roblox fails twice, the run stops spending its quota on the games after it", async () => {
	const ran: string[] = [];
	const { result, log } = await quietly(() =>
		runEngine(
			["", "--ui vide", "--language luau"],
			"/g",
			async (dir) => {
				ran.push(dir);
				return outcome(3, infra);
			},
			0,
		),
	);
	assert.equal(result, 1);
	assert.equal(ran.length, 2, "one game, twice");
	assert.match(log, /Roblox's side failed twice \(exit 3\)/);
	assert.match(log, /not run: Roblox's side failed on the game before/);
});

const probed = {
	first: "x.ts:2 prefer-const: never reassigned",
	second: "x.ts:2 prefer-const: never reassigned",
	listening: true,
};

test("the edit hook works when both calls report the lint problem and the server it started is up", () => {
	assert.equal(editHookFailure(probed), undefined);
});

test("the edit hook fails when a call says nothing, or the server isn't there for the second call", () => {
	assert.match(editHookFailure({ ...probed, first: "" }) ?? "", /first call/);
	assert.match(editHookFailure({ ...probed, listening: false }) ?? "", /server wasn't listening/);
	assert.match(editHookFailure({ ...probed, second: "" }) ?? "", /second call/);
});

test("a TypeScript batch runs the edit hook for its first game only, and fails that game when it doesn't work", async () => {
	const probes: string[] = [];
	const steps = (result: EditHookProbe): Steps => ({
		...fakeSteps({}),
		probeEditHook: async (dir) => {
			probes.push(dir.split("/").slice(-2).join("/"));
			return result;
		},
	});
	const luau = { ...batch(["", "--ui react"]), name: "luau 1/1", language: "luau" as const };
	assert.equal((await quietly(() => runBatch(luau, "/g", steps(probed), "/t"))).result, 0);
	assert.deepEqual(probes, [], "a Luau game has no ESLint server");
	const ok = await quietly(() => runBatch(batch(["--language typescript", "--ui vide"]), "/g", steps(probed), "/t"));
	assert.equal(ok.result, 0);
	assert.deepEqual(probes, ["0/coin-rush"]);
	assert.match(ok.log, /edit hook ran/);
	const bad = await quietly(() => runBatch(batch([""]), "/g", steps({ ...probed, first: "" }), "/t"));
	assert.equal(bad.result, 1);
	assert.match(bad.log, /first call/);
});
