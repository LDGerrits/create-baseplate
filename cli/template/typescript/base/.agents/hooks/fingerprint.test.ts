import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
	alreadyPassed,
	CHECK_RECORD,
	commitSkip,
	markdownOnly,
	partId,
	readRecord,
	recordFile,
	stagedFiles,
	stateId,
	writeRecord,
} from "./fingerprint.ts";

/** A repo with one commit, run with git's variables unset: inside a commit hook they point at the outer repo. */
function inRepo(body: (dir: string, git: (...args: string[]) => string) => void) {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-")));
	const saved = Object.entries(process.env).filter(([key]) => key.startsWith("GIT_"));
	for (const [key] of saved) delete process.env[key];
	const git = (...args: string[]) =>
		spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, encoding: "utf8" }).stdout;
	try {
		git("init", "-q");
		fs.writeFileSync(path.join(dir, ".gitignore"), "/out\n");
		fs.writeFileSync(path.join(dir, "a.ts"), "1");
		fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lock 1");
		git("add", "-A");
		git("commit", "-q", "-m", "start");
		body(dir, git);
	} finally {
		Object.assign(process.env, Object.fromEntries(saved));
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

const write = (dir: string, file: string, content: string) => {
	fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
	fs.writeFileSync(path.join(dir, file), content);
};

test("a clean folder's files and index are the same state, and a change to either moves it", () => {
	inRepo((dir, git) => {
		const clean = stateId(dir, "files");
		assert.ok(clean !== undefined);
		assert.equal(stateId(dir, "index"), clean);
		assert.equal(git("rev-parse", "HEAD^{tree}").trim(), clean);
		write(dir, "a.ts", "2");
		assert.notEqual(stateId(dir, "files"), clean);
		assert.equal(stateId(dir, "index"), clean);
	});
});

test("an untracked file, a deleted file and a changed lockfile each change the state; an ignored file doesn't", () => {
	inRepo((dir) => {
		const clean = stateId(dir, "files");
		write(dir, "out/built.luau", "x");
		assert.equal(stateId(dir, "files"), clean);
		write(dir, "b.ts", "new");
		const added = stateId(dir, "files");
		assert.notEqual(added, clean);
		fs.rmSync(path.join(dir, "b.ts"));
		assert.equal(stateId(dir, "files"), clean);
		fs.rmSync(path.join(dir, "a.ts"));
		const deleted = stateId(dir, "files");
		assert.notEqual(deleted, clean);
		write(dir, "a.ts", "1");
		write(dir, "pnpm-lock.yaml", "lock 2");
		const locked = stateId(dir, "files");
		assert.notEqual(locked, clean);
		assert.notEqual(locked, deleted);
	});
});

test("what is staged is told from what is on disk, and the index is left alone", () => {
	inRepo((dir, git) => {
		write(dir, "a.ts", "2");
		git("add", "a.ts");
		const staged = stateId(dir, "index");
		assert.equal(stateId(dir, "files"), staged);
		write(dir, "a.ts", "3");
		const disk = stateId(dir, "files");
		assert.notEqual(disk, staged);
		assert.equal(stateId(dir, "index"), staged);
		writeRecord(dir, CHECK_RECORD, disk ?? "");
		assert.equal(alreadyPassed(dir, "files"), true);
		assert.equal(alreadyPassed(dir, "index"), false);
		assert.equal(git("diff", "--cached", "--name-only").trim(), "a.ts");
		assert.equal(git("show", ":a.ts"), "2");
		write(dir, "a.ts", "2");
		write(dir, "c.ts", "x");
		writeRecord(dir, CHECK_RECORD, stateId(dir, "files") ?? "");
		assert.equal(alreadyPassed(dir, "index"), false);
		git("add", "-A");
		assert.equal(alreadyPassed(dir, "index"), true);
	});
});

test("a pass is recorded in the worktree's own git folder, which no commit holds", () => {
	inRepo((dir, git) => {
		assert.equal(readRecord(dir, CHECK_RECORD), undefined);
		writeRecord(dir, CHECK_RECORD, "abc");
		assert.equal(readRecord(dir, CHECK_RECORD), "abc");
		assert.equal(recordFile(dir, CHECK_RECORD), path.join(dir, ".git", CHECK_RECORD));
		assert.equal(git("status", "--porcelain").trim(), "");
		git("worktree", "add", "-q", "--detach", "wt");
		assert.match(recordFile(path.join(dir, "wt"), CHECK_RECORD) ?? "", /\.git[/\\]worktrees[/\\]wt[/\\]check-passed$/);
		assert.equal(readRecord(path.join(dir, "wt"), CHECK_RECORD), undefined);
	});
});

test("a part's id moves only with the files it picks", () => {
	inRepo((dir) => {
		write(dir, "scripts/x.ts", "1");
		const picks = (file: string) => file.startsWith("scripts/");
		const tree = () => stateId(dir, "files") ?? "";
		const before = partId(dir, tree(), picks);
		write(dir, "a.ts", "other");
		assert.equal(partId(dir, tree(), picks), before);
		write(dir, "scripts/x.ts", "2");
		assert.notEqual(partId(dir, tree(), picks), before);
	});
});

test("a part's files are found from a project folder inside a bigger repo", () => {
	inRepo((dir) => {
		const project = path.join(dir, "game");
		write(dir, "game/scripts/x.ts", "1");
		write(dir, "other/scripts/x.ts", "1");
		const picks = (file: string) => file.startsWith("scripts/");
		const tree = stateId(project, "files") ?? "";
		const before = partId(project, tree, picks);
		write(dir, "other/scripts/x.ts", "2");
		assert.equal(partId(project, stateId(project, "files") ?? "", picks), before);
		write(dir, "game/scripts/x.ts", "2");
		assert.notEqual(partId(project, stateId(project, "files") ?? "", picks), before);
	});
});

test("outside a repo there is no state to match, so nothing is skipped", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fingerprint-"));
	try {
		assert.equal(stateId(dir, "files"), undefined);
		assert.equal(stateId(dir, "index"), undefined);
		assert.equal(alreadyPassed(dir, "files"), false);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Markdown only: every changed file, whatever the case or the folder", () => {
	assert.equal(markdownOnly(["README.md", "docs/Guide.MD", ".agents/skills/x/SKILL.md"]), true);
	assert.equal(markdownOnly(["README.md", "src/a.ts"]), false);
	assert.equal(markdownOnly(["AGENTS.md.baseplate-new"]), false);
	assert.equal(markdownOnly(["notes.mdx"]), false);
	assert.equal(markdownOnly([]), false);
});

test("the commit hook skips a Markdown-only commit and a commit of the state that passed, and nothing else", () => {
	inRepo((dir, git) => {
		write(dir, "README.md", "hi");
		git("add", "-A");
		assert.deepEqual(stagedFiles(dir), ["README.md"]);
		assert.match(commitSkip(dir, stagedFiles(dir)) ?? "", /Markdown/);
		git("commit", "-q", "-m", "docs");

		git("mv", "README.md", "src.ts");
		assert.deepEqual(stagedFiles(dir).sort(), ["README.md", "src.ts"]);
		assert.equal(commitSkip(dir, stagedFiles(dir)), undefined);
		git("reset", "-q", "--hard");

		write(dir, "a.ts", "2");
		git("add", "-A");
		assert.equal(commitSkip(dir, stagedFiles(dir)), undefined);
		write(dir, "a.ts", "3");
		writeRecord(dir, CHECK_RECORD, stateId(dir, "files") ?? "");
		assert.equal(commitSkip(dir, stagedFiles(dir)), undefined);
		git("add", "-A");
		assert.match(commitSkip(dir, stagedFiles(dir)) ?? "", /already passed/);
		git("rm", "-qf", "a.ts");
		assert.equal(commitSkip(dir, stagedFiles(dir)), undefined);
	});
});
