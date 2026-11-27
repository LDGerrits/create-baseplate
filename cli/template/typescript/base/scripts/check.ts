// The check: `mise run check` fixes formatting and runs every step that doesn't need another's
// result at the same time, so the slowest one bounds the run. `mise run ci` is the same steps
// without the fixes. Each step's output is held back and printed only for a step that failed, in
// the order of the list below, then one line says how it went.
//
//   node scripts/check.ts [--ci] [--all] [--verbose]
//
// A step is a command and its arguments, split at spaces ("double quotes" keep spaces in one
// argument), run without a shell so it works the same on Windows. `needs` names the steps that must
// pass first; a step whose need failed doesn't run. Add a step to the list, with what it needs.
//
// When the check passes, it records the state of the files (.agents/hooks/fingerprint.ts), which the
// stop hook and the commit hook read to skip a check that already passed on exactly this state.
// The tooling's own type-check and tests run only when the tooling changed since they last passed;
// on CI (the CI variable is set) and with --all, they always run.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CHECK_RECORD, partId, readRecord, stateId, writeRecord } from "../.agents/hooks/fingerprint.ts";
import { hintsFor } from "../.agents/hooks/hints.ts";

// The locked packages first, before this script or any step loads one: a new clone or worktree has
// none yet, and another branch's lockfile may differ. Instant when they already match.
const deps = spawnSync("mise", ["run", "--quiet", "deps"], {
	cwd: path.resolve(import.meta.dirname, ".."),
	encoding: "utf8",
	stdio: process.argv.includes("--quiet") ? "pipe" : "inherit",
	shell: process.platform === "win32",
});
if (deps.status !== 0) {
	console.error(
		`✗ deps: mise run deps failed\n${deps.error?.message ?? ""}${deps.stdout ?? ""}${deps.stderr ?? ""}`.trim(),
	);
	process.exit(1);
}
const { default: spawn } = await import("cross-spawn");

interface Step {
	name: string;
	command: string;
	needs: string[];
	/** What `mise run check` runs instead of `command` (`mise run ci` runs `command`): the step's fixing form. */
	fixCommand?: string;
	/** Formats files: once these are done, the files are as the check will leave them. */
	format?: boolean;
	/** The tooling's: skipped while its files are as they were when it last passed. */
	tooling?: boolean;
	/**
	 * Started with the check, before its needs pass, and sent a line on its input once they do; its
	 * command waits for that line. For a step whose startup, which needs nothing, is most of its time.
	 */
	warm?: boolean;
}

/** The workflow files, as quoted paths from the project's root. */
function workflows() {
	const folder = path.join(import.meta.dirname, "..", ".github", "workflows");
	const names = fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => /\.ya?ml$/.test(name)) : [];
	return names.map((name) => `".github/workflows/${name}"`).join(" ");
}

const steps: Step[] = [
	// Writes the generated files each later step reads; the packages are installed above.
	{ name: "generate", command: "mise run --quiet --skip-deps generate", needs: [] },
	// The Luau beside the TypeScript (scripts/luau.ts; nothing to do in a game without any), formatted
	// before the format step, which the others wait for.
	{
		name: "stylua",
		command: "node scripts/luau.ts stylua",
		fixCommand: "node scripts/luau.ts stylua --fix",
		needs: ["generate"],
		format: true,
	},
	{
		name: "format",
		command: "biome ci .",
		fixCommand: "biome check --write --no-errors-on-unmatched .",
		needs: ["generate", "stylua"],
		format: true,
	},
	{ name: "compile", command: "mise run --quiet --skip-deps compile", needs: ["format"] },
	// Tests named so they never run, and services nothing starts.
	{ name: "sources", command: "node scripts/check-sources.ts", needs: ["format"] },
	// The agent files at the create-baseplate version package.json pins, and no clash left unmerged.
	{ name: "agent-files", command: "node scripts/agent-files.ts --check", needs: ["format"] },
	{ name: "tooling-types", command: "tsc -p tsconfig.node.json", needs: ["format"], tooling: true },
	// The workflows in .github/workflows: expressions, job and step names, the actions' inputs. Named
	// one by one: with none named, actionlint looks for them through git, and the game may not be a repo.
	{ name: "workflows", command: `actionlint ${workflows()}`, needs: ["format"], tooling: true },
	// The agent hooks' and scripts' own tests.
	{
		name: "tooling-tests",
		command: 'node --test --test-reporter=dot ".agents/hooks/*.test.ts" "scripts/*.test.ts"',
		needs: ["format"],
		tooling: true,
	},
	// In a multi-place game, the shared code alone, so it can't lean on one place's map.
	{
		name: "shared-types",
		command: 'node scripts/each-place.ts --if-multi "tsc --noEmit -p tsconfig.json"',
		needs: ["compile"],
	},
	// Rogen checks the compiled Luau too: without out/ it reports every source folder as empty.
	{ name: "rogen", command: 'node scripts/each-place.ts --parallel "rogen check"', needs: ["compile"] },
	{ name: "luau-lsp", command: "node scripts/luau.ts analyze", needs: ["format"] },
	{ name: "selene", command: "node scripts/luau.ts selene", needs: ["format"] },
	// No --cache: type-aware rules depend on other files, which the cache doesn't track.
	// ESLint loads its config and plugins while the files are generated and formatted (scripts/lint.ts).
	{
		name: "lint",
		command: "node scripts/lint.ts --wait",
		fixCommand: "node scripts/lint.ts --wait --fix",
		needs: ["format"],
		warm: true,
	},
	{
		name: "place",
		command:
			'node scripts/each-place.ts --parallel "mkdir build" "rojo build game.project.json --output build/game.rbxl" "lune run {root}/scripts/check-place build/game.rbxl"',
		needs: ["compile"],
	},
	{ name: "test", command: 'node scripts/each-place.ts --parallel "node {root}/scripts/test.ts"', needs: ["compile"] },
	{
		name: "ui",
		command: 'node scripts/each-place.ts --parallel "node {root}/scripts/ui.ts --check"',
		needs: ["compile"],
	},
];

/** The files the tooling's type-check and tests read, as paths from the project's root. */
const toolingFile = (file: string) =>
	!file.includes("/") || /^(scripts|\.agents|\.claude|\.codex|\.cursor|\.gemini|\.github\/workflows)\//.test(file);
const TOOLING_RECORD = "check-tooling-passed";

const words = (command: string) => [...command.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? "");

interface Outcome {
	step: Step;
	ok: boolean;
	output: string;
	seconds: number;
	/** Why it didn't run, when it didn't. */
	skipped?: string;
}

/** A step's process: `done` once it exits; `go` sends a warm step the line it waits for. */
interface Started {
	done: Promise<Outcome>;
	go: () => void;
	cancel: () => void;
}

function start(step: Step): Started {
	let since = performance.now();
	let go = () => {};
	let cancel = () => {};
	const done = new Promise<Outcome>((resolve) => {
		const [command = "", ...args] = words(step.command);
		let output = "";
		const done = (ok: boolean) => resolve({ step, ok, output, seconds: (performance.now() - since) / 1000 });
		const child = spawn(command, args, { cwd: ROOT, stdio: [step.warm === true ? "pipe" : "ignore", "pipe", "pipe"] });
		// A warm step that already exited (its startup failed) has no input left to write to.
		child.stdin?.on("error", () => {});
		go = () => {
			since = performance.now();
			child.stdin?.end("go\n");
		};
		cancel = () => child.stdin?.end();
		const take = (chunk: Buffer) => {
			output += chunk.toString("utf8");
		};
		child.stdout?.on("data", take);
		child.stderr?.on("data", take);
		child.on("error", (error) => {
			output += `${command}: ${error.message}\n`;
			done(false);
		});
		child.on("close", (code) => done(code === 0));
	});
	return { done, go, cancel };
}

const ROOT = path.resolve(import.meta.dirname, "..");
const ci = process.argv.includes("--ci");
const verbose = process.argv.includes("--verbose");
const everything = process.argv.includes("--all") || (process.env.CI ?? "") !== "";

// What the fixing steps changed, so a person sees it: the game's own source files, by content.
const SOURCES = ["src", "tests", "projects"];
const GENERATED_SOURCE =
	/(^|\/)(world\.d\.ts|[^/]*\.project\.json|sourcemap\.json)$|(^|\/)(node_modules|out|include|build|dist|Packages|ServerPackages|DevPackages)\//;
function sourceHashes(): Map<string, string> {
	const hashes = new Map<string, string>();
	const walk = (dir: string) => {
		let entries: fs.Dirent[];
		try {
			entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true });
		} catch {
			return; // gone while the check runs
		}
		for (const entry of entries) {
			const relative = `${dir}/${entry.name}`;
			if (GENERATED_SOURCE.test(entry.isDirectory() ? `${relative}/` : relative)) continue;
			if (entry.isDirectory()) walk(relative);
			else if (entry.isFile()) {
				try {
					hashes.set(
						relative,
						createHash("sha256")
							.update(fs.readFileSync(path.join(ROOT, relative)))
							.digest("hex"),
					);
				} catch {}
			}
		}
	};
	for (const dir of SOURCES) walk(dir);
	return hashes;
}

const before = ci ? undefined : sourceHashes();
const started = performance.now();
const list = steps.map((step) => ({ ...step, command: (!ci && step.fixCommand) || step.command }));

const outcomes = new Map<string, Outcome>();
const running = new Map<string, Promise<void>>();
const warm = new Map(list.filter((step) => step.warm === true).map((step) => [step.name, start(step)]));
let formatted: { files?: string; tooling?: string } | undefined;
let toolingUnchanged = false;

/** Once formatting is done the files are as the check will leave them: note the state they pass in. */
function noteFormatted() {
	if (formatted !== undefined) return;
	const files = stateId(ROOT, "files");
	const tree = files === undefined ? undefined : partId(ROOT, files, toolingFile);
	formatted = { files, tooling: tree };
	toolingUnchanged = !everything && tree !== undefined && readRecord(ROOT, TOOLING_RECORD) === tree;
}

await new Promise<void>((finish) => {
	const settle = () => {
		for (const step of list) {
			if (outcomes.has(step.name) || running.has(step.name)) continue;
			const needs = step.needs.map((need) => outcomes.get(need));
			if (needs.some((need) => need === undefined)) continue;
			if (needs.some((need) => need?.ok !== true)) {
				warm.get(step.name)?.cancel();
				outcomes.set(step.name, { step, ok: false, output: "", seconds: 0, skipped: "a step it needs failed" });
				continue;
			}
			if (step.tooling === true && toolingUnchanged) {
				warm.get(step.name)?.cancel();
				outcomes.set(step.name, {
					step,
					ok: true,
					output: "",
					seconds: 0,
					skipped: "tooling unchanged since it last passed",
				});
				continue;
			}
			const launched = warm.get(step.name) ?? start(step);
			launched.go();
			running.set(
				step.name,
				launched.done.then((outcome) => {
					outcomes.set(step.name, outcome);
					if (list.every((one) => one.format !== true || outcomes.get(one.name)?.ok === true)) noteFormatted();
					running.delete(step.name);
					settle();
				}),
			);
		}
		if (running.size === 0) finish();
	};
	settle();
});

if (before !== undefined) {
	const after = sourceHashes();
	const fixed = [...after]
		.filter(([file, hash]) => before.has(file) && before.get(file) !== hash)
		.map(([file]) => file);
	if (fixed.length > 0) console.log(`Fixed formatting or lint in: ${fixed.join(", ")}`);
}
// ESLint's fixes land while the other steps read the files as they were: check the fixed files once more.
const lint = outcomes.get("lint");
if (lint?.output.includes("@eslint-fixed") === true) {
	lint.output = lint.output.replace("@eslint-fixed\n", "");
	if (!ci && process.env.BASEPLATE_CHECK_AGAIN === undefined) {
		const again = spawnSync(process.execPath, process.argv.slice(1), {
			stdio: "inherit",
			env: { ...process.env, BASEPLATE_CHECK_AGAIN: "1" },
		});
		process.exit(again.status ?? 1);
	}
}
const failed = list.filter((step) => outcomes.get(step.name)?.ok !== true);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
for (const step of list) {
	const outcome = outcomes.get(step.name);
	if (outcome === undefined) continue;
	if (outcome.skipped !== undefined) {
		if (verbose) console.log(`- ${step.name}: skipped, ${outcome.skipped}`);
		continue;
	}
	if (!outcome.ok || verbose) {
		console.log(`${outcome.ok ? "✓" : "✗"} ${step.name} (${outcome.seconds.toFixed(1)}s): ${step.command}`);
		const text = outcome.output.trim();
		if (text !== "") console.log(`${text}\n`);
	}
}
if (failed.length > 0) {
	const hints = hintsFor(failed.map((step) => outcomes.get(step.name)?.output ?? "").join("\n"));
	if (hints.length > 0) console.log(`${hints.join("\n")}\n`);
	const blocked = failed.filter((step) => outcomes.get(step.name)?.skipped !== undefined).map((step) => step.name);
	const own = failed.filter((step) => !blocked.includes(step.name)).map((step) => step.name);
	console.log(
		`✗ ${ci ? "ci" : "check"} failed in ${seconds}s: ${own.join(", ")}${blocked.length > 0 ? ` (not run: ${blocked.join(", ")})` : ""}`,
	);
	process.exit(1);
}

// A step that ran on a state the files then left was not checking what is now there; record only a
// state that held from the end of formatting to the end of the check.
const after = stateId(ROOT, "files");
if (formatted?.files !== undefined && formatted.files === after) {
	writeRecord(ROOT, CHECK_RECORD, after);
	if (formatted.tooling !== undefined) writeRecord(ROOT, TOOLING_RECORD, formatted.tooling);
}
const skipped = list.filter((step) => outcomes.get(step.name)?.skipped !== undefined).map((step) => step.name);
console.log(
	`✓ ${ci ? "ci" : "check"} passed in ${seconds}s (${list.length - skipped.length} steps${skipped.length > 0 ? `; skipped, unchanged: ${skipped.join(", ")}` : ""})`,
);
