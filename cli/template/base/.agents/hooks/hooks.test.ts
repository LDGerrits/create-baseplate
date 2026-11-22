// The hooks' decisions, fed the payloads each agent tool sends. `mise run check` runs these.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { changedFiles, failureOutput, passFile, treeHash, wantsCheck } from "./check.ts";
import { guardOutput, guardReason, type Payload } from "./guard.ts";

const root = "/game";
const reason = (payload: Payload) => guardReason(payload, root, root);

test("blocks edits to generated files, whatever the tool calls its path", () => {
	const edits: Payload[] = [
		{ tool_name: "Edit", tool_input: { file_path: "/game/out/app/main.server.luau" } }, // Claude Code
		{ tool_name: "Write", tool_input: { path: "default.project.json" } }, // Cursor
		{ toolName: "edit", toolArgs: '{"path":"/game/src/world.d.ts","old_str":"a","new_str":"b"}' }, // Copilot
		{ toolName: "create", toolArgs: { path: "build/game.rbxl", file_text: "" } }, // Copilot
		{ tool_name: "write_file", tool_input: { file_path: "game.project.json", content: "{}" } }, // Gemini CLI
		{ tool_name: "replace", tool_input: { file_path: "include/RuntimeLib.lua", old_string: "", new_string: "" } },
		{ tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: out/x.luau\n" } }, // Codex
	];
	for (const payload of edits) assert.match(reason(payload) ?? "", /is generated/, JSON.stringify(payload));
	assert.equal(reason({ tool_name: "Edit", tool_input: { file_path: "/game/src/app/app.tsx" } }), undefined);
	assert.equal(reason({ toolName: "edit", toolArgs: { path: "src/features/clicker/server/x.ts" } }), undefined);
});

test("blocks commands that skip the rules, from each tool's shell", () => {
	const commands: Payload[] = [
		{ tool_name: "Bash", tool_input: { command: "git commit --no-verify -m wip" } },
		{ tool_name: "Shell", tool_input: { command: "npm install lodash", working_directory: "/game" } },
		{ toolName: "bash", toolArgs: '{"command":"npx eslint src"}' },
		{ tool_name: "run_shell_command", tool_input: { command: "cat .env", dir_path: "." } },
		{ command: "git config core.hooksPath /dev/null" }, // Cursor's beforeShellExecution
	];
	for (const payload of commands) assert.notEqual(reason(payload), undefined, JSON.stringify(payload));
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: 'git commit -m "no -n here"' } }), undefined);
	assert.equal(reason({ tool_name: "run_shell_command", tool_input: { command: "mise run check" } }), undefined);
});

test("blocks reading .env, but not reading generated files", () => {
	assert.match(reason({ tool_name: "Read", tool_input: { file_path: "/game/.env" } }) ?? "", /secret/);
	assert.match(reason({ toolName: "view", toolArgs: { path: ".env.local" } }) ?? "", /secret/);
	assert.match(reason({ tool_name: "read_file", tool_input: { file_path: ".env" } }) ?? "", /secret/);
	assert.match(reason({ hook_event_name: "beforeReadFile", file_path: "/game/.env" }) ?? "", /secret/);
	assert.equal(reason({ toolName: "view", toolArgs: { path: ".env.example" } }), undefined);
	assert.equal(reason({ tool_name: "Read", tool_input: { file_path: "/game/out/x.luau" } }), undefined);
});

test("answers in each tool's format", () => {
	assert.equal(guardOutput("claude", undefined), undefined);
	assert.deepEqual(guardOutput("claude", "no"), {
		hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "no" },
	});
	assert.deepEqual(guardOutput("cursor", undefined), { permission: "allow" });
	assert.deepEqual(guardOutput("cursor", "no"), { permission: "deny", agent_message: "no", user_message: "no" });
	assert.equal(guardOutput("copilot", undefined), undefined);
	assert.deepEqual(guardOutput("copilot", "no"), { permissionDecision: "deny", permissionDecisionReason: "no" });
	assert.equal(guardOutput("gemini", undefined), undefined);
	assert.deepEqual(guardOutput("gemini", "no"), { decision: "deny", reason: "no" });
});

test("Cursor's stop runs the check only after a finished turn, a few times", () => {
	assert.equal(wantsCheck("cursor", { status: "completed", loop_count: 0 }), true);
	assert.equal(wantsCheck("cursor", { status: "aborted", loop_count: 0 }), false);
	assert.equal(wantsCheck("cursor", { status: "error" }), false);
	assert.equal(wantsCheck("cursor", { status: "completed", loop_count: 3 }), false);
	assert.equal(wantsCheck("claude", {}), true);
});

test("a failing check sends the agent back once, then tells the user", () => {
	assert.deepEqual(failureOutput("claude", {}, "boom"), { decision: "block", reason: expect("boom") });
	assert.deepEqual(failureOutput("copilot", { stop_hook_active: false }, "boom"), {
		decision: "block",
		reason: expect("boom"),
	});
	assert.deepEqual(failureOutput("gemini", {}, "boom"), { decision: "deny", reason: expect("boom") });
	assert.deepEqual(failureOutput("cursor", { status: "completed" }, "boom"), { followup_message: expect("boom") });
	assert.match(JSON.stringify(failureOutput("claude", { stop_hook_active: true }, "boom")), /systemMessage/);
	assert.match(JSON.stringify(failureOutput("gemini", { stop_hook_active: true }, "boom")), /systemMessage/);
	assert.equal(failureOutput("copilot", { stop_hook_active: true }, "boom"), undefined);
});
const expect = (output: string) =>
	`\`mise run check\` fails after your changes. Fix it, or tell the user why it stays failing:\n${output}`;

test("the tree hash changes with every change, and the pass record sits in the worktree's git folder", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hooks-"));
	const back = process.cwd();
	// Inside a commit hook, git's variables would point these git commands at the outer repo.
	const saved = Object.entries(process.env).filter(([key]) => key.startsWith("GIT_"));
	for (const [key] of saved) delete process.env[key];
	const git = (...args: string[]) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
	try {
		git("init", "-q");
		git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "start");
		process.chdir(dir);
		const clean = treeHash();
		assert.deepEqual(changedFiles(), []);
		fs.writeFileSync("a.ts", "1");
		const one = treeHash();
		assert.notEqual(one, clean);
		assert.deepEqual(changedFiles(), ["a.ts"]);
		fs.writeFileSync("a.ts", "2");
		assert.notEqual(treeHash(), one);
		fs.writeFileSync("a.ts", "1");
		assert.equal(treeHash(), one);
		fs.writeFileSync("notes.md", "x");
		assert.deepEqual(changedFiles(), ["a.ts"]);
		assert.equal(passFile(), path.join(fs.realpathSync(dir), ".git", "agent-check-passed"));
		git("worktree", "add", "-q", "--detach", "wt");
		process.chdir(path.join(dir, "wt"));
		assert.match(passFile() ?? "", /\.git[/\\]worktrees[/\\]wt[/\\]agent-check-passed$/);
	} finally {
		process.chdir(back);
		Object.assign(process.env, Object.fromEntries(saved));
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
