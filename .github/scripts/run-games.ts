// What a CI job (.github/workflows/ci.yml) does with the games it was given, one after another.
// A game that fails doesn't stop the ones after it: each is a group in the log, the job ends with a
// table of them all, and it fails when any did.
//
//   node .github/scripts/run-games.ts check     GAMES is one batch (generate-matrix.ts): create each game with the
//                                               CLI, then check it, and the batch's template first.
//   node .github/scripts/run-games.ts prepare   GAMES is a list of flags: create each game.
//   node .github/scripts/run-games.ts engine    run the prepared games' specs in real Roblox.
//
// CLI is the create-baseplate entry file to run, GAMES_DIR the folder the games are made in.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { type Outcome, run as runCommand } from "../../scripts/run.ts";
import type { Batch } from "./generate-matrix.ts";

export type { Outcome };

/** Runs a command, printing what it prints as it prints it (the standard output too, unless `quiet`). */
export const run = (
	command: string,
	args: string[],
	cwd: string,
	{ env, quiet = false }: { env?: NodeJS.ProcessEnv; quiet?: boolean } = {},
) => runCommand(command, args, cwd, { env, echo: quiet ? "stderr" : "all" });

const ESC = String.fromCharCode(27);
const stripAnsi = (text: string) => text.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");

/**
 * Whether a jest-roblox run failed because Roblox's side did, which running it again can fix, not
 * because a test did: exit 3, its "Roblox Infrastructure Error" (a task that never finished, a task
 * create refused with a 429), or exit 2 with a "Backend Error" caused by an HTTP 5xx, a network error
 * or a poll that timed out. A failing test exits 1, whatever it prints.
 */
export function isInfrastructureFailure(code: number | null, output: string): boolean {
	const text = stripAnsi(output);
	if (code === 3) return text.includes("Roblox Infrastructure Error");
	if (code === 2) {
		return text.includes("Backend Error") && /\b(ApiError: HTTP 5\d\d|NetworkError|PollTimeoutError)\b/.test(text);
	}
	return false;
}

export interface Row {
	name: string;
	/** Why it failed; undefined when it passed. */
	failure?: string;
	seconds: number;
	/** What happened besides the pass or fail, such as a retry. */
	note?: string;
}

const group = async <T>(title: string, body: () => Promise<T>): Promise<T> => {
	console.log(`::group::${title}`);
	try {
		return await body();
	} finally {
		console.log("::endgroup::");
	}
};

/** Times `body` as a row: a thrown error or a returned reason is its failure. */
async function timed(
	name: string,
	body: () => Promise<string | undefined | { failure?: string; note?: string }>,
): Promise<Row> {
	const start = Date.now();
	let result: Awaited<ReturnType<typeof body>>;
	try {
		result = await body();
	} catch (error) {
		result = error instanceof Error ? error.message : String(error);
	}
	const { failure, note } = typeof result === "object" ? result : { failure: result, note: undefined };
	return { name, failure, note, seconds: Math.round((Date.now() - start) / 100) / 10 };
}

/** The table of every row, as Markdown for the job's summary page, and the errors to annotate. */
export function summarise(title: string, rows: Row[]): { markdown: string; text: string } {
	const failed = rows.filter((row) => row.failure !== undefined);
	const line = (row: Row) =>
		`${row.failure === undefined ? "passed" : "FAILED"}  ${row.seconds.toFixed(1).padStart(6)} s  ${row.name}${row.note === undefined ? "" : ` (${row.note})`}`;
	const text = [`${title}: ${rows.length - failed.length} of ${rows.length} passed`, ...rows.map(line)].join("\n");
	const markdown = [
		`### ${title}: ${rows.length - failed.length} of ${rows.length} passed`,
		"",
		"| | Game | Seconds | |",
		"|---|---|---|---|",
		...rows.map(
			(row) =>
				`| ${row.failure === undefined ? "✅" : "❌"} | \`${row.name}\` | ${row.seconds.toFixed(1)} | ${row.failure === undefined ? (row.note ?? "") : row.failure.split("\n")[0]} |`,
		),
		"",
	].join("\n");
	return { markdown, text };
}

/** Prints the table, annotates each failure, and writes the job's summary page. Returns the exit code. */
function report(title: string, rows: Row[]): number {
	const { markdown, text } = summarise(title, rows);
	console.log(`\n${text}`);
	for (const row of rows) {
		if (row.failure !== undefined) console.log(`::error title=${row.name}::${row.failure.replaceAll("\n", "%0A")}`);
	}
	if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
	return rows.some((row) => row.failure !== undefined) ? 1 : 0;
}

/** What the CLI's `--json` prints, of it. */
export interface Created {
	ok?: boolean;
	created?: boolean;
	committed?: boolean;
	error?: string;
	warnings?: string[];
}

/** What a game's steps need from outside, so a test can stand in for them. */
export interface Steps {
	/** Creates the game with the CLI; the CLI's `--json` result, parsed, if it printed one. */
	create(flags: string, dir: string): Promise<{ code: number | null; result?: Created }>;
	/** Runs a mise task in a folder. */
	mise(args: string[], dir: string): Promise<number | null>;
	/** The game's `core.hooksPath`. */
	hooksPath(dir: string): Promise<string>;
	/** Calls a TypeScript game's edit hook twice on a file with a lint problem; see `editHookFailure`. */
	probeEditHook?(dir: string): Promise<EditHookProbe>;
}

/** What calling a game's edit hook twice, on the same edited file, printed, and whether its ESLint server was up after. */
export interface EditHookProbe {
	first: string;
	second: string;
	listening: boolean;
}

/** The problem the probe file has, as ESLint names it: a `let` nothing reassigns. */
export const PROBE_RULE = "prefer-const";

/**
 * Why a probe of the edit hook shows it isn't working, or undefined when it is: both calls must report
 * the lint problem the file has, and the server the first one started must still be listening (it is
 * what the second call asks, a named pipe on Windows).
 */
export function editHookFailure({ first, second, listening }: EditHookProbe): string | undefined {
	if (!first.includes(PROBE_RULE))
		return `the edit hook didn't report the lint problem on the first call: ${first.trim() || "(no output)"}`;
	if (!listening) return "the edit hook's ESLint server wasn't listening after the first call";
	if (!second.includes(PROBE_RULE))
		return `the edit hook didn't report the lint problem on the second call: ${second.trim() || "(no output)"}`;
	return undefined;
}

/** The last line of `stdout` that is a JSON object: what `--json` printed. */
export function lastJson(stdout: string): Created | undefined {
	for (const line of stdout.trim().split("\n").reverse()) {
		if (!line.startsWith("{")) continue;
		try {
			return JSON.parse(line) as Created;
		} catch {
			return undefined;
		}
	}
	return undefined;
}

/**
 * Creates one game and checks it. The first commit runs the game's commit hook, which runs
 * `mise run ci` on the committed files, so that is the game's check: a game committed there isn't
 * checked a second time. A game left uncommitted (its add-ons wait for an install) is checked here.
 * Returns why the game failed, if it did.
 */
export async function checkGame(
	flags: string,
	dir: string,
	steps: Steps,
): Promise<{ failure?: string; note?: string }> {
	const created = await steps.create(flags, dir);
	if (created.code !== 0) {
		// The CLI exits 1 when the first commit fails: its hook ran the game's check, and the CLI printed its report.
		if (created.result?.created === true)
			return { failure: "the first commit failed, so the game's check did; the report is above" };
		return {
			failure: `creating the game failed${created.code === null ? "" : ` (exit ${created.code})`}; the output is above`,
		};
	}
	let note: string;
	if (created.result?.committed === true) {
		// The hook is what checked the game; a game whose hook is off was committed without a check.
		const hooks = await steps.hooksPath(dir);
		if (hooks !== ".githooks") {
			return {
				failure: `the first commit didn't run the game's commit hook (core.hooksPath is "${hooks}"), so nothing checked the game`,
			};
		}
		console.log("The first commit's hook ran the game's check (mise run ci), and it passed.");
		note = "checked in the first commit";
	} else {
		console.log("The first commit waits for an install, so the check runs here: mise run ci");
		const code = await steps.mise(["run", "ci"], dir);
		if (code !== 0)
			return { failure: `mise run ci failed${code === null ? "" : ` (exit ${code})`}; the output is above` };
		note = "checked after creating";
	}
	// The game runs this when it publishes, with --release.
	if (flags.split(" ").includes("--release")) {
		const code = await steps.mise(["run", "release"], dir);
		if (code !== 0)
			return { failure: `mise run release failed${code === null ? "" : ` (exit ${code})`}; the output is above` };
	}
	return { note };
}

const isTypeScript = (flags: string) => !flags.split(" ").includes("luau");

/** A batch: its template's check first, then each game. Returns the job's exit code. */
export async function runBatch(batch: Batch, gamesDir: string, steps: Steps, templateDir: string): Promise<number> {
	const rows: Row[] = [];
	if (batch.template) {
		const name = `template ${batch.language}`;
		rows.push(
			await group(name, () =>
				timed(name, async () => {
					for (const args of [["trust", "--quiet"], ["install"], ["run", "install"], ["run", "ci"]]) {
						const code = await steps.mise(args, path.join(templateDir, batch.language, "base"));
						if (code !== 0)
							return `mise ${args.join(" ")} failed${code === null ? "" : ` (exit ${code})`}; the output is above`;
					}
					return undefined;
				}),
			),
		);
	}
	// The first TypeScript game's edit hook is run for real too: its ESLint server listens on a named
	// pipe on Windows, a socket elsewhere, and the hook's tests alone don't show it works in a game.
	let probed = false;
	for (const [index, flags] of batch.games.entries()) {
		const name = flags === "" ? "(no add-ons)" : flags;
		const dir = path.join(gamesDir, String(index), "coin-rush");
		const probe = steps.probeEditHook !== undefined && !probed && isTypeScript(flags);
		if (probe) probed = true;
		rows.push(
			await group(name, () =>
				timed(name, async () => {
					const checked = await checkGame(flags, dir, steps);
					if (checked.failure !== undefined || !probe) return checked;
					const failure = editHookFailure(
						(await steps.probeEditHook?.(dir)) ?? { first: "", second: "", listening: false },
					);
					return failure === undefined ? { note: `${checked.note}; edit hook ran` } : { failure };
				}),
			),
		);
	}
	return report(`Games in ${batch.name}`, rows);
}

/** Retries `attempt` while its outcome is `retryable`, up to `retries` times, waiting `delayMs`. */
export async function withRetry(
	attempt: () => Promise<Outcome>,
	retryable: (outcome: Outcome) => boolean,
	{ retries, delayMs, onRetry }: { retries: number; delayMs: number; onRetry: (outcome: Outcome) => void },
): Promise<{ outcome: Outcome; retried: number }> {
	let outcome = await attempt();
	let retried = 0;
	while (outcome.code !== 0 && retried < retries && retryable(outcome)) {
		onRetry(outcome);
		await sleep(delayMs);
		retried += 1;
		outcome = await attempt();
	}
	return { outcome, retried };
}

/**
 * The prepared games' specs in real Roblox, one at a time (they share one test place), each retried
 * once when Roblox's side failed. When it fails again, Roblox is down: the games after it aren't run.
 * Returns the job's exit code.
 */
export async function runEngine(
	games: string[],
	gamesDir: string,
	test: (dir: string) => Promise<Outcome>,
	delayMs = 60_000,
): Promise<number> {
	const rows: Row[] = [];
	let down = false;
	for (const [index, flags] of games.entries()) {
		const name = flags === "" ? "(no add-ons)" : flags;
		if (down) {
			rows.push({ name, failure: "not run: Roblox's side failed on the game before", seconds: 0 });
			continue;
		}
		const dir = path.join(gamesDir, String(index), "coin-rush");
		rows.push(
			await group(name, () =>
				timed(name, async () => {
					const { outcome, retried } = await withRetry(
						() => test(dir),
						(o) => isInfrastructureFailure(o.code, o.output),
						{
							retries: 1,
							delayMs,
							onRetry: () =>
								console.log(
									`::warning title=${name}::Roblox's side failed; running the specs again in ${delayMs / 1000} s`,
								),
						},
					);
					const note = retried > 0 ? "passed on the second try, after a Roblox error" : undefined;
					if (outcome.code === 0) return { note };
					if (isInfrastructureFailure(outcome.code, outcome.output)) {
						down = true;
						return `Roblox's side failed${retried > 0 ? " twice" : ""} (exit ${outcome.code}), not a spec; the output is above`;
					}
					return `the specs failed (exit ${outcome.code}); the output is above`;
				}),
			),
		);
	}
	return report("Games in real Roblox", rows);
}

/** Calls the game's edit hook twice, as an agent tool does after a write, on a file with a lint problem. */
async function probeEditHook(dir: string): Promise<EditHookProbe> {
	const folder = fs.existsSync(path.join(dir, "projects", "common", "src"))
		? "projects/common/src/probe"
		: "src/game/probe";
	const file = `${folder}/probe.ts`;
	const full = path.join(dir, file);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, "export const value = 1;\nlet total = 2;\nexport const sum = total + value;\n");
	const payload = JSON.stringify({ tool_name: "Write", tool_input: { file_path: file }, cwd: dir });
	const call = () =>
		spawnSync("mise", ["exec", "--", "node", ".agents/hooks/edited.ts", "claude"], {
			cwd: dir,
			input: payload,
			encoding: "utf8",
			timeout: 120_000,
		}).stdout;
	try {
		const first = call();
		const { socketPath } = (await import(
			pathToFileURL(path.join(dir, ".agents", "hooks", "eslint-server.ts")).href
		)) as {
			socketPath(root: string): string;
		};
		const listening = await new Promise<boolean>((resolve) => {
			const connection = net.connect(socketPath(dir));
			connection.setTimeout(3000, () => connection.destroy());
			connection.on("connect", () => {
				connection.destroy();
				resolve(true);
			});
			connection.on("error", () => resolve(false));
		});
		return { first, second: call(), listening };
	} finally {
		fs.rmSync(path.dirname(full), { recursive: true, force: true });
	}
}

function need(name: string): string {
	const value = process.env[name];
	if (value === undefined || value === "") throw new Error(`${name} isn't set`);
	return value;
}

if (import.meta.main) {
	const mode = process.argv[2];
	const gamesDir = path.resolve(need("GAMES_DIR"));
	const templateDir = path.resolve(import.meta.dirname, "../../cli/template");
	const cli = () => path.resolve(need("CLI"));
	const create = async (flags: string, dir: string) => {
		// The JSON on one line is for scripts: print what it says instead.
		const { code, stdout } = await run(
			process.execPath,
			[cli(), dir, "--json", ...flags.split(" ").filter((flag) => flag !== "")],
			process.cwd(),
			{ quiet: true },
		);
		const result = lastJson(stdout);
		if (result === undefined) console.log(stdout);
		else {
			for (const warning of result.warnings ?? []) console.log(`Warning: ${warning}`);
			console.log(result.error ?? `Created ${dir}${result.committed === true ? ", with its first commit" : ""}.`);
		}
		return { code, result };
	};
	const steps: Steps = {
		create,
		mise: async (args, dir) => (await run("mise", args, dir)).code,
		hooksPath: async (dir) => (await run("git", ["config", "core.hooksPath"], dir, { quiet: true })).stdout.trim(),
		probeEditHook,
	};
	if (mode === "check") {
		process.exitCode = await runBatch(JSON.parse(need("GAMES")) as Batch, gamesDir, steps, templateDir);
	} else if (mode === "prepare") {
		// The engine job's games, created before the step that has the key.
		const games = JSON.parse(need("GAMES")) as string[];
		const rows: Row[] = [];
		for (const [index, flags] of games.entries()) {
			const name = flags === "" ? "(no add-ons)" : flags;
			const dir = path.join(gamesDir, String(index), "coin-rush");
			rows.push(
				await group(name, () =>
					timed(name, async () => {
						const created = await create(flags, dir);
						return created.code === 0
							? undefined
							: `creating the game failed (exit ${created.code}); the output is above`;
					}),
				),
			);
		}
		process.exitCode = report("Games created", rows);
	} else if (mode === "engine") {
		const games = JSON.parse(need("GAMES")) as string[];
		// The key is in this step's environment and goes to the specs' command alone.
		process.exitCode = await runEngine(games, gamesDir, (dir) =>
			run("mise", ["run", "test:engine", "--", "--backend", "open-cloud"], dir),
		);
	} else {
		throw new Error("The mode is check, prepare or engine.");
	}
}
