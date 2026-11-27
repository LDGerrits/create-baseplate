import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CHECK_RECORD, partId, readRecord, stateId, writeRecord } from "../.agents/hooks/fingerprint.ts";
import { hintsFor } from "../.agents/hooks/hints.ts";

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
	fixCommand?: string;
	format?: boolean;
	tooling?: boolean;
	warm?: boolean;
}

function workflows() {
	const folder = path.join(import.meta.dirname, "..", ".github", "workflows");
	const names = fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => /\.ya?ml$/.test(name)) : [];
	return names.map((name) => `".github/workflows/${name}"`).join(" ");
}

const steps: Step[] = [
	{ name: "generate", command: "mise run --quiet --skip-deps generate", needs: [] },
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
	{ name: "agent-files", command: "node scripts/agent-files.ts --check", needs: ["format"] },
	{ name: "tooling-types", command: "tsc -p tsconfig.node.json", needs: ["format"], tooling: true },
	// The workflows in .github/workflows: expressions, job and step names, the actions' inputs. Named
	// one by one: with none named, actionlint looks for them through git, and the game may not be a repo.
	{ name: "workflows", command: `actionlint ${workflows()}`, needs: ["format"], tooling: true },
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

const toolingFile = (file: string) =>
	!file.includes("/") || /^(scripts|\.agents|\.claude|\.codex|\.cursor|\.gemini|\.github\/workflows)\//.test(file);
const TOOLING_RECORD = "check-tooling-passed";

const words = (command: string) => [...command.matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? "");

interface Outcome {
	step: Step;
	ok: boolean;
	output: string;
	seconds: number;
	skipped?: string;
}

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
const STEP_LINES = 40;
const everything = process.argv.includes("--all") || (process.env.CI ?? "") !== "";

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
			return;
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
// What the check saw: the files as formatting left them, unless something changed them after.
const after = stateId(ROOT, "files");
const files: { state: "unknown" } | { state: "settled"; id: string } | { state: "changed" } =
	formatted?.files === undefined
		? { state: "unknown" }
		: formatted.files === after
			? { state: "settled", id: formatted.files }
			: { state: "changed" };
if (files.state === "changed" && !ci && process.env.BASEPLATE_CHECK_AGAIN === undefined) {
	const again = spawnSync(process.execPath, process.argv.slice(1), {
		stdio: "inherit",
		env: { ...process.env, BASEPLATE_CHECK_AGAIN: "1" },
	});
	process.exit(again.status ?? 1);
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
		const lines = text.split("\n");
		const shown = ci || verbose || lines.length <= STEP_LINES ? text : lines.slice(0, STEP_LINES).join("\n");
		const more = lines.length - STEP_LINES;
		if (text !== "") {
			console.log(
				`${shown}${shown === text ? "" : `\n… ${more} more lines: run \`${step.command}\` for all of them`}\n`,
			);
		}
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

if (files.state === "changed" && !ci) {
	console.log("✗ check: files changed while it ran, so it saw none of them whole; run it again.");
	process.exit(1);
}
if (files.state === "settled") {
	writeRecord(ROOT, CHECK_RECORD, files.id);
	if (formatted?.tooling !== undefined) writeRecord(ROOT, TOOLING_RECORD, formatted.tooling);
}
const skipped = list.filter((step) => outcomes.get(step.name)?.skipped !== undefined).map((step) => step.name);
console.log(
	`✓ ${ci ? "ci" : "check"} passed in ${seconds}s (${list.length - skipped.length} steps${skipped.length > 0 ? `; skipped, unchanged: ${skipped.join(", ")}` : ""})`,
);
