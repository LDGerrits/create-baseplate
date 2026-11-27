import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MAIN_VARIANTS } from "../cli/test/variants.ts";
import { applyCorpus, corpusFlags, type Language } from "./corpus.ts";
import { run } from "./run.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const AT_ONCE = 4;

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const keep = args.includes("--keep");
const matrix = args.includes("--matrix");
const corpus = args.includes("--corpus");
const flags = args.filter((arg) => arg !== "--keep" && arg !== "--matrix" && arg !== "--corpus");
if (corpus && (matrix || flags.length > 0)) {
	console.log("✗ --corpus makes one game of each language with no add-ons, as CI does; it takes no other flags.");
	process.exit(1);
}
const given = new Set(flags.filter((flag) => flag.startsWith("--")));
const languages: Language[] = ["typescript", "luau"];
const variants = corpus
	? languages.map(corpusFlags)
	: matrix
		? MAIN_VARIANTS.filter((variant) => !variant.some((flag) => given.has(flag))).map((variant) => [
				...variant,
				...flags,
			])
		: [flags];

const build = await run("pnpm", ["--filter", "create-baseplate", "build"], ROOT, { echo: "none" });
if (build.code !== 0) {
	console.log(`✗ the CLI didn't build:\n${build.output.trim().split("\n").slice(-20).join("\n")}`);
	process.exit(1);
}

const base = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-try-"));
const env = { ...process.env, BASEPLATE_NO_CLAUDE_PLUGIN: "1", BASEPLATE_TOOLING_TESTS: "1" };

async function tryOne(variant: string[], index: number): Promise<boolean> {
	const dir = path.join(base, `game-${index + 1}`);
	const name = variant.join(" ") || "the defaults";
	const started = performance.now();
	const created = await run("node", [path.join(ROOT, "cli/dist/index.js"), dir, "--json", ...variant], ROOT, {
		env,
		echo: "none",
	});
	let seconds = ((performance.now() - started) / 1000).toFixed(1);
	let result: { ok?: boolean; error?: string } = {};
	try {
		result = JSON.parse(created.stdout.slice(created.stdout.indexOf("{")));
	} catch {}
	if (created.code === 0 && result.ok === true && corpus) {
		applyCorpus(dir, variant.includes("typescript") ? "typescript" : "luau");
		const checked = await run("mise", ["run", "ci"], dir, { env, echo: "none" });
		seconds = ((performance.now() - started) / 1000).toFixed(1);
		if (checked.code !== 0) {
			const why = checked.output.trim().split("\n").slice(-25).join("\n  ");
			console.log(`✗ the corpus in ${name} (${seconds}s): ${dir}\n  ${why}`);
			return false;
		}
	}
	if (created.code === 0 && result.ok === true) {
		console.log(`✓ ${corpus ? "the corpus in " : ""}${name} (${seconds}s)${keep ? `: ${dir}` : ""}`);
		if (!keep) fs.rmSync(dir, { recursive: true, force: true });
		return true;
	}
	const why = (result.error ?? created.output).trim().split("\n").slice(-25).join("\n  ");
	console.log(`✗ ${name} (${seconds}s): ${dir}\n  ${why}`);
	return false;
}

const results: boolean[] = [];
for (let start = 0; start < variants.length; start += AT_ONCE) {
	const batch = variants.slice(start, start + AT_ONCE);
	results.push(...(await Promise.all(batch.map((variant, i) => tryOne(variant, start + i)))));
}
if (fs.readdirSync(base).length === 0) fs.rmSync(base, { recursive: true, force: true });
const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? `✓ ${results.length} passed` : `✗ ${failed} of ${results.length} failed`);
process.exit(failed === 0 ? 0 : 1);
