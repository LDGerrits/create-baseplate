// What a created game's AGENTS.md, skills and README name must exist in that game: an agent follows
// a stale pointer into a dead end, and these files are edited by hand in many places.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { create, tempDir } from "./helpers.ts";

const VARIANTS = [
	[],
	["--language", "luau"],
	["--managed", "partial"],
	["--language", "luau", "--managed", "partial"],
	["--places", "multi"],
	["--language", "luau", "--places", "multi"],
	["--ui", "vide"],
	["--language", "luau", "--ui", "vide"],
];

/** The game's mise tasks, by name. */
const taskNames = (miseToml: string) =>
	new Set([...miseToml.matchAll(/^\[tasks\.("?)([\w:-]+)\1\]/gm)].map((match) => match[2] ?? ""));

/** The files an agent reads for instructions, and the README a person reads. */
function docs(dir: string): [string, string][] {
	const skills = path.join(dir, ".agents", "skills");
	const files = [
		"AGENTS.md",
		"README.md",
		...fs.readdirSync(skills).map((skill) => path.join(".agents", "skills", skill, "SKILL.md")),
	];
	return files.map((file) => [file, fs.readFileSync(path.join(dir, file), "utf8")]);
}

for (const flags of VARIANTS) {
	test(`what the docs name exists in a game made with ${flags.join(" ") || "the defaults"}`, () => {
		const cwd = tempDir();
		const run = create(cwd, "game", ...flags);
		assert.equal(run.status, 0, run.stderr);
		const dir = path.join(cwd, "game");
		const tasks = taskNames(fs.readFileSync(path.join(dir, "mise.toml"), "utf8"));
		const skills = new Set(fs.readdirSync(path.join(dir, ".agents", "skills")));
		const missing: string[] = [];
		for (const [file, text] of docs(dir)) {
			for (const [, task = ""] of text.matchAll(/`mise run ([\w:-]+)/g)) {
				if (!tasks.has(task)) missing.push(`${file}: mise task ${task}`);
			}
			for (const [, skill = ""] of text.matchAll(/\.agents\/skills\/([\w-]+)\//g)) {
				if (!skills.has(skill)) missing.push(`${file}: skill ${skill}`);
			}
			for (const [, skill = ""] of text.matchAll(/^- `([\w-]+)`:/gm)) {
				if (file === "AGENTS.md" && !skills.has(skill) && /^[a-z]+(-[a-z]+)*$/.test(skill)) {
					missing.push(`${file}: skill ${skill} in the index`);
				}
			}
			for (const [, script = ""] of text.matchAll(/`((?:scripts|\.agents)\/[\w./-]+\.(?:ts|luau|sh|mjs))`/g)) {
				if (!fs.existsSync(path.join(dir, script))) missing.push(`${file}: ${script}`);
			}
		}
		// And the other way: each skill is in the index, or agents aren't pointed to it.
		const agents = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
		for (const skill of skills) {
			if (!agents.includes(`- \`${skill}\`:`)) missing.push(`AGENTS.md: skill ${skill} missing from the index`);
		}
		assert.deepEqual(missing, []);
	});
}
