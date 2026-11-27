import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";

export const CLI = path.resolve(import.meta.dirname, "../dist/index.js");
const temps: string[] = [];
export const tempDir = () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "create-baseplate-"));
	temps.push(dir);
	return dir;
};
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});
// CI has no git identity configured; a person's machine does.
export const GIT_IDENTITY = {
	GIT_AUTHOR_NAME: "Test",
	GIT_AUTHOR_EMAIL: "test@example.com",
	GIT_COMMITTER_NAME: "Test",
	GIT_COMMITTER_EMAIL: "test@example.com",
};
export const create = (cwd: string, ...args: string[]) =>
	spawnSync("node", [CLI, ...args, "--json", "--no-install"], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, ...GIT_IDENTITY },
	});
