import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const CLI = path.resolve(import.meta.dirname, "..");
const LANGUAGES = ["typescript", "luau"] as const;

export function codeBlocks(markdown: string): string[] {
	return [...markdown.matchAll(/^```(?:tsx|ts|typescript|luau|lua)\n([\s\S]*?)^```$/gm)].map(([, code = ""]) => code);
}

export const codeLines = (code: string) =>
	code
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("--"));

export function appearsIn(lines: string[], file: string): boolean {
	const fileLines = file.split("\n").map((line) => line.trim());
	let at = 0;
	for (const line of lines) {
		const found = fileLines.indexOf(line, at);
		if (found === -1) return false;
		at = found + 1;
	}
	return true;
}

const filesUnder = (dir: string): string[] =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const at = path.join(dir, entry.name);
		return entry.isDirectory() ? filesUnder(at) : [at];
	});

test("a block's code lines are found in order, its comments skipped", () => {
	const block = "// where it goes\nconst a = 1;\n\nconst b = 2;\n";
	assert.equal(appearsIn(codeLines(block), "const a = 1;\nconst x = 0;\n\tconst b = 2;\n"), true);
	assert.equal(appearsIn(codeLines(block), "const b = 2;\nconst a = 1;\n"), false);
	assert.deepEqual(codeBlocks("text\n```ts\nconst a = 1;\n```\n```sh\nls\n```\n"), ["const a = 1;\n"]);
});

for (const language of LANGUAGES) {
	test(`every code example in the ${language} skills is in the ${language} corpus`, () => {
		const corpus = filesUnder(path.join(CLI, "corpus", language)).map((file) => fs.readFileSync(file, "utf8"));
		const skills = path.join(CLI, "template", language, "base", ".agents", "skills");
		const missing: string[] = [];
		for (const skill of fs.readdirSync(skills)) {
			const text = fs.readFileSync(path.join(skills, skill, "SKILL.md"), "utf8");
			for (const [index, block] of codeBlocks(text).entries()) {
				if (!corpus.some((file) => appearsIn(codeLines(block), file))) {
					missing.push(`${skill}, example ${index + 1}: ${codeLines(block)[0] ?? ""}`);
				}
			}
		}
		assert.deepEqual(missing, []);
	});
}
