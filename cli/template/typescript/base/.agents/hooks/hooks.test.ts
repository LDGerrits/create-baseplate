// The hooks' decisions, fed the payloads each agent tool sends. `mise run check` runs these.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { changedFiles, failureOutput, wantsCheck } from "./check.ts";
import { biomeProblems, editedFiles, editedOutput, filesToCheck } from "./edited.ts";
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
	assert.equal(reason({ toolName: "edit", toolArgs: { path: "src/features/shop/server/x.ts" } }), undefined);
});

test("blocks commands that skip the rules, from each tool's shell", () => {
	const commands: Payload[] = [
		{ tool_name: "Bash", tool_input: { command: "git commit --no-verify -m wip" } },
		{ tool_name: "Shell", tool_input: { command: "npm install lodash", working_directory: "/game" } },
		{ toolName: "bash", toolArgs: '{"command":"npx eslint src"}' },
		{ tool_name: "run_shell_command", tool_input: { command: "cat .env", dir_path: "." } },
		{ command: "git config core.hooksPath /dev/null" }, // Cursor's beforeShellExecution
		{ tool_name: "Bash", tool_input: { command: "mise run publish" } },
		{ tool_name: "Bash", tool_input: { command: "mise x -- node scripts/publish.ts build/game.rbxl" } },
	];
	for (const payload of commands) assert.notEqual(reason(payload), undefined, JSON.stringify(payload));
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: 'git commit -m "no -n here"' } }), undefined);
	assert.equal(reason({ tool_name: "run_shell_command", tool_input: { command: "mise run check" } }), undefined);
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: "git diff scripts/publish.ts" } }), undefined);
});

test("blocks Studio's MCP from acting on the live game", () => {
	for (const tool_name of [
		"mcp__Roblox_Studio__open_cloud_invoke",
		"Roblox_Studio-open_cloud_invoke",
		"open_cloud_invoke",
	]) {
		assert.match(reason({ tool_name, tool_input: { method: "GET" } }) ?? "", /Open Cloud/, tool_name);
	}
	const luau = (code: string) =>
		reason({ tool_name: "mcp__Roblox_Studio__execute_luau", tool_input: { code, datamodel_type: "Server" } });
	assert.match(luau('game:GetService("DataStoreService"):GetDataStore("Players")') ?? "", /real player data/);
	assert.match(luau('HttpService:GetAsync("https://example.com")') ?? "", /real player data/);
	assert.match(
		reason({ toolName: "Roblox_Studio-execute_luau", toolArgs: '{"code":"HttpService:RequestAsync({})"}' }) ?? "",
		/internet/,
	);
	assert.equal(luau("print(workspace.SpawnLocation.Position)"), undefined);
	assert.equal(luau('print(game:GetService("HttpService"):JSONEncode({ 1 }))'), undefined);
	assert.equal(
		reason({ tool_name: "mcp__Roblox_Studio__inspect_instance", tool_input: { path: "Workspace" } }),
		undefined,
	);
	// Cursor's beforeMCPExecution names the server's launch command, which isn't the agent's command.
	assert.equal(
		reason({
			hook_event_name: "beforeMCPExecution",
			tool_name: "create_issue",
			command: "npx -y @some/mcp-server",
			tool_input: {},
		}),
		undefined,
	);
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

test("finds the edited files in each tool's payload, and none where it names none", () => {
	const edits: [Payload, string[]][] = [
		[
			{ tool_name: "Edit", tool_input: { file_path: "/game/src/a.ts", old_string: "a", new_string: "b" } },
			["/game/src/a.ts"],
		], // Claude Code
		[
			{
				tool_name: "apply_patch",
				tool_input: {
					command:
						"*** Begin Patch\n*** Update File: src/a.ts\n@@\n-a\n+b\n*** Add File: src/b.ts\n+x\n*** Delete File: src/c.ts\n*** End Patch",
				},
			},
			["src/a.ts", "src/b.ts", "src/c.ts"],
		], // Codex; a deleted file no longer exists, so the hook drops it
		[{ toolName: "edit", toolArgs: '{"path":"/game/src/a.ts","old_str":"a","new_str":"b"}' }, ["/game/src/a.ts"]], // Copilot
		[{ toolName: "create", toolArgs: { path: "src/b.ts", file_text: "" } }, ["src/b.ts"]],
		[{ tool_name: "replace", tool_input: { file_path: "src/a.ts", old_string: "a", new_string: "b" } }, ["src/a.ts"]], // Gemini CLI
		[{ hook_event_name: "afterFileEdit", file_path: "/game/src/a.ts", workspace_roots: ["/game"] }, ["/game/src/a.ts"]], // Cursor
		[{ tool_name: "Edit", tool_input: {} }, []],
		[{ tool_name: "apply_patch", tool_input: {} }, []],
		[{}, []],
	];
	for (const [payload, files] of edits) assert.deepEqual(editedFiles(payload), files, JSON.stringify(payload));
});

test("checks only the project's own files that Biome formats, not generated ones", () => {
	const files = [
		"/game/src/a.ts",
		"src/a.ts",
		"src/app/app.tsx",
		"/game/tsconfig.json",
		"README.md",
		"tests/e2e/shop.luau",
		"/elsewhere/x.ts",
		"../x.ts",
		"out/app/main.server.luau",
		"include/Promise.ts",
		"default.project.json",
		"src/world.d.ts",
		"projects/lobby/src/world.d.ts",
		"node_modules/x/index.js",
	];
	assert.deepEqual(filesToCheck(files, root, root), ["src/a.ts", "src/app/app.tsx", "tsconfig.json"]);
	assert.deepEqual(filesToCheck(["b.ts", "../c.ts"], root, "/game/src"), ["src/b.ts", "c.ts"]);
});

test("reads Biome's errors", () => {
	const output =
		"::error title=parse,file=/game/world/x.json,line=3,endLine=3,col=9,endColumn=10::Expected a property but instead found ','.\n\nSome errors were emitted\n";
	assert.deepEqual(biomeProblems(output, root), [
		"world/x.json:3 biome(parse): Expected a property but instead found ','.",
	]);
	assert.deepEqual(biomeProblems("Checked 1 file in 5ms. No fixes applied.\n", root), []);
});

test("hands the problems left to the agent in each tool's format, and caps them", () => {
	const problem = "src/a.ts:3 prefer-const: 'x' is never reassigned.";
	for (const format of ["claude", "copilot", "gemini", "cursor"] as const)
		assert.equal(editedOutput(format, []), undefined);
	assert.equal(editedOutput("cursor", [problem]), undefined);
	const message = (output: object | undefined) => JSON.stringify(output);
	assert.deepEqual(Object.keys(editedOutput("claude", [problem]) ?? {}), ["hookSpecificOutput"]);
	assert.match(
		message(editedOutput("claude", [problem])),
		/"hookEventName":"PostToolUse","additionalContext":".*prefer-const/,
	);
	assert.match(
		message(editedOutput("gemini", [problem])),
		/"hookEventName":"AfterTool","additionalContext":".*prefer-const/,
	);
	assert.match(message(editedOutput("copilot", [problem])), /^\{"additionalContext":".*prefer-const/);
	const many = message(
		editedOutput(
			"claude",
			Array.from({ length: 25 }, (_, i) => `src/a.ts:${i} rule: x`),
		),
	);
	assert.match(many, /src\/a\.ts:9 rule/);
	assert.doesNotMatch(many, /src\/a\.ts:10 rule/);
	assert.match(many, /and 15 more/);
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

test("the stop hook looks only at changed files that aren't Markdown", () => {
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
		assert.deepEqual(changedFiles(), []);
		fs.writeFileSync("a.ts", "1");
		assert.deepEqual(changedFiles(), ["a.ts"]);
		fs.writeFileSync("notes.md", "x");
		fs.writeFileSync("README.MD", "x");
		assert.deepEqual(changedFiles(), ["a.ts"]);
	} finally {
		process.chdir(back);
		Object.assign(process.env, Object.fromEntries(saved));
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

// The PATH it builds from symbolic links to sh, cat and grep only works outside Windows.
test("without mise, the guard still blocks Studio's live tools and publishing, and lets the rest through", {
	skip: process.platform === "win32",
}, () => {
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "no-mise-"));
	// A PATH with only what `run` needs, so a mise installed system-wide can't stand in.
	const bin = path.join(home, "bin");
	fs.mkdirSync(bin);
	for (const tool of ["sh", "cat", "dirname", "grep"]) {
		const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
		fs.symlinkSync(found, path.join(bin, tool));
	}
	const guard = (format: string, payload: Payload) =>
		spawnSync(path.join(bin, "sh"), [path.join(import.meta.dirname, "run"), "guard.ts", format], {
			input: JSON.stringify(payload),
			encoding: "utf8",
			env: { PATH: bin, HOME: home },
		});
	try {
		const live: Payload = { tool_name: "mcp__Roblox_Studio__open_cloud_invoke", tool_input: {} };
		const claude = guard("claude", live);
		assert.equal(claude.status, 0);
		assert.equal(JSON.parse(claude.stdout).hookSpecificOutput.permissionDecision, "deny");
		assert.equal(JSON.parse(guard("copilot", live).stdout).permissionDecision, "deny");
		assert.equal(JSON.parse(guard("gemini", live).stdout).decision, "deny");
		assert.equal(JSON.parse(guard("cursor", live).stdout).permission, "deny");
		// Cursor reads a deny from the JSON on stdout of an exit 0, and fails open on any other exit.
		const cursorLive = guard("cursor", live);
		assert.equal(cursorLive.status, 0);
		assert.equal(JSON.parse(cursorLive.stdout).permission, "deny");
		assert.match(JSON.parse(cursorLive.stdout).agent_message, /blocked/);
		const cursorPublish = guard("cursor", { tool_name: "Shell", tool_input: { command: "mise run publish" } });
		assert.equal(JSON.parse(cursorPublish.stdout).permission, "deny");
		const cursorStudio = guard("cursor", { command: "mise run publish", cwd: "/game" });
		assert.equal(JSON.parse(cursorStudio.stdout).permission, "deny");
		assert.equal(guard("cursor", { tool_name: "Shell", tool_input: { command: "ls" } }).stdout, "");
		const publish = guard("claude", { tool_name: "Bash", tool_input: { command: "mise run publish" } });
		assert.equal(JSON.parse(publish.stdout).hookSpecificOutput.permissionDecision, "deny");
		assert.equal(guard("claude", { tool_name: "Bash", tool_input: { command: "ls" } }).stdout, "");
		const copilotPublish = guard("copilot", { toolName: "bash", toolArgs: '{"command":"mise run publish"}' });
		assert.equal(JSON.parse(copilotPublish.stdout).permissionDecision, "deny");
		// Only the tool and the command count, not what an edit writes.
		const edit = {
			tool_name: "Write",
			tool_input: { file_path: "notes.md", content: "open_cloud_invoke, mise run publish" },
		};
		assert.equal(guard("claude", edit).stdout, "");
	} finally {
		fs.rmSync(home, { recursive: true, force: true });
	}
});

test("Cursor's hooks go through .agents/hooks/run, so the guard fails closed without mise", () => {
	const hooks = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../.cursor/hooks.json"), "utf8")) as {
		hooks: Record<string, { command: string }[]>;
	};
	for (const [event, list] of Object.entries(hooks.hooks)) {
		for (const { command } of list) {
			assert.match(command, /^sh \.agents\/hooks\/run \w+\.ts cursor$/, event);
		}
	}
});

// The check runs `rogen check`, so Rogen's own stop hook (rogen-check.mjs, which stays as Rogen writes it)
// would run it a second time at every stop.
test("no agent tool starts Rogen's stop hook beside the check", () => {
	const folder = path.join(import.meta.dirname, "../..");
	for (const file of [".claude/settings.json", ".codex/hooks.json", ".cursor/hooks.json", ".gemini/settings.json"]) {
		assert.doesNotMatch(fs.readFileSync(path.join(folder, file), "utf8"), /rogen-check/, file);
	}
	assert.match(fs.readFileSync(path.join(folder, "scripts/check.ts"), "utf8"), /rogen check/);
});

// Claude Code's own deny rules for reading keys, beside the guard: the guard blocks every `.env`
// variant but `.env.example`, and permission rules take no exceptions, so each variant is listed.
test("Claude Code's deny rules cover every .env variant the guard blocks, and not .env.example", () => {
	const settings = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../../.claude/settings.json"), "utf8"));
	const globs = (settings.permissions.deny as string[])
		.map((rule) => /^Read\(\.\/(.+)\)$/.exec(rule)?.[1])
		.filter((glob): glob is string => glob !== undefined)
		.map((glob) => new RegExp(`^${glob.replace(/[.+^${}()|\\]/g, "\\$&").replaceAll("*", "[^/]*")}$`));
	const denied = (file: string) => globs.some((glob) => glob.test(file));
	const variants = [".env", ".env.local", ".env.development", ".env.production", ".env.staging", ".env.test"];
	variants.push(".env.dev", ".env.prod", ".env.development.local", ".env.production.local");
	for (const file of variants) {
		assert.equal(denied(file), true, `${file} is denied`);
		assert.match(
			reason({ tool_name: "Read", tool_input: { file_path: file } }) ?? "",
			/secret/,
			`the guard blocks ${file}`,
		);
	}
	assert.equal(denied(".env.example"), false);
});

test("lets the read-only errors task run", () => {
	const run = (command: string) => reason({ tool_name: "Bash", tool_input: { command } });
	assert.equal(run("mise run errors -- 42"), undefined);
	assert.equal(run("mise run errors -- --hours 6 --json"), undefined);
});
