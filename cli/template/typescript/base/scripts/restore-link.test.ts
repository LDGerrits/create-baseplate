import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { restoreLink } from "./restore-link.ts";

test("a link checked out as a text file becomes a link again; a real link stays", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "link-"));
	try {
		fs.mkdirSync(path.join(dir, ".agents/skills/write-tests"), { recursive: true });
		fs.writeFileSync(path.join(dir, ".agents/skills/write-tests/SKILL.md"), "skill");
		fs.mkdirSync(path.join(dir, ".claude"));
		const link = path.join(dir, ".claude/skills");
		fs.writeFileSync(link, "../.agents/skills");
		assert.equal(restoreLink(link), process.platform === "win32" ? "junction" : "link");
		assert.equal(fs.readFileSync(path.join(link, "write-tests/SKILL.md"), "utf8"), "skill");
		assert.equal(restoreLink(link), undefined);
		assert.equal(restoreLink(path.join(dir, "missing")), undefined);
		fs.writeFileSync(path.join(dir, "note"), "not a folder");
		assert.equal(restoreLink(path.join(dir, "note")), undefined);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
