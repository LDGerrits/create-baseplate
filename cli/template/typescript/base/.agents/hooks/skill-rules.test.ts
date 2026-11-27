import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { forgetSkills, globPattern, newSkills, readRules } from "./skill-rules.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

test("globs match as the rules mean them", () => {
	assert.ok(globPattern("**/*.spec.ts").test("src/features/shop/server/shop-service.spec.ts"));
	assert.ok(globPattern("**/*.spec.ts").test("a.spec.ts"));
	assert.ok(globPattern("world/**").test("world/Workspace/Part.model.json"));
	assert.ok(globPattern("projects/*/world/**").test("projects/lobby/world/Lighting.project.json"));
	assert.ok(!globPattern("projects/*/world/**").test("projects/a/b/world/x"));
	assert.ok(!globPattern("mise.toml").test("projects/lobby/mise.toml"));
});

test("every path rule names a skill the game has, with the same globs for Cursor and Copilot", () => {
	const rules = readRules(ROOT);
	assert.ok(rules.length > 0);
	for (const { skill, globs } of rules) {
		assert.ok(globs.length > 0, skill);
		assert.ok(fs.existsSync(path.join(ROOT, ".agents", "skills", skill, "SKILL.md")), skill);
		const cursor = fs.readFileSync(path.join(ROOT, ".cursor", "rules", `${skill}.mdc`), "utf8");
		assert.match(cursor, new RegExp(`^globs: ${globs.join(",").replace(/[*.]/g, "\\$&")}$`, "m"), skill);
		const copilot = fs.readFileSync(path.join(ROOT, ".github", "instructions", `${skill}.instructions.md`), "utf8");
		assert.ok(copilot.includes(`applyTo: "${globs.join(",")}"`), skill);
	}
});

test("names each skill once per session", () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-rules-"));
	try {
		fs.mkdirSync(path.join(root, ".claude", "rules"), { recursive: true });
		fs.writeFileSync(path.join(root, ".claude", "rules", "write-tests.md"), '---\npaths:\n  - "**/*.spec.ts"\n---\n');
		assert.deepEqual(newSkills(root, ["src/a.spec.ts"], "s1"), ["write-tests"]);
		assert.deepEqual(newSkills(root, ["src/b.spec.ts"], "s1"), []);
		assert.deepEqual(newSkills(root, ["src/b.spec.ts"], "s2"), ["write-tests"]);
		assert.deepEqual(newSkills(root, ["src/a.ts"], "s3"), []);
		assert.deepEqual(newSkills(root, ["src/a.spec.ts"], undefined), []);
		// After a compaction the session starts over.
		forgetSkills(root, "s1");
		assert.deepEqual(newSkills(root, ["src/b.spec.ts"], "s1"), ["write-tests"]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});
