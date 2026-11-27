import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { changedFiles, failureOutput, wantsCheck } from "./check.ts";
import {
	biomeProblems,
	editedFiles,
	editedOutput,
	filesToCheck,
	seleneProblems,
	sourcemapFiles,
	sourcemapStale,
	styluaProblems,
} from "./edited.ts";
import { guardOutput, guardReason, type Payload } from "./guard.ts";
import { isShell, movesFiles, runsTask, writtenSince } from "./written.ts";

const root = "/game";
const reason = (payload: Payload) => guardReason(payload, root, root);

test("blocks edits to generated files, whatever the tool calls its path", () => {
	const edits: Payload[] = [
		{ tool_name: "Edit", tool_input: { file_path: "/game/Packages/React.lua" } }, // Claude Code
		{ tool_name: "Write", tool_input: { path: "default.project.json" } }, // Cursor
		{ toolName: "edit", toolArgs: '{"path":"/game/sourcemap.json","old_str":"a","new_str":"b"}' }, // Copilot
		{ toolName: "create", toolArgs: { path: "build/game.rbxl", file_text: "" } }, // Copilot
		{ tool_name: "write_file", tool_input: { file_path: "game.project.json", content: "{}" } }, // Gemini CLI
		{ tool_name: "replace", tool_input: { file_path: "wally.lock", old_string: "", new_string: "" } },
		{ tool_name: "apply_patch", tool_input: { command: "*** Begin Patch\n*** Update File: DevPackages/Jest.lua\n" } }, // Codex
	];
	for (const payload of edits) assert.match(reason(payload) ?? "", /is generated/, JSON.stringify(payload));
	assert.equal(reason({ tool_name: "Edit", tool_input: { file_path: "/game/src/app/client/Start.luau" } }), undefined);
	assert.equal(reason({ toolName: "edit", toolArgs: { path: "src/features/shop/server/X.luau" } }), undefined);
	assert.equal(reason({ tool_name: "Edit", tool_input: { file_path: "/game/wally.toml" } }), undefined);
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
		{ tool_name: "Bash", tool_input: { command: "mise run --quiet publish" } },
		{ tool_name: "Bash", tool_input: { command: "mise r publish" } },
		{ tool_name: "Bash", tool_input: { command: "mise publish" } },
		{ tool_name: "Bash", tool_input: { command: "mise tasks run publish" } },
		{ tool_name: "Bash", tool_input: { command: "cd scripts && node publish.ts ../build/game.rbxl" } },
		{ tool_name: "Bash", tool_input: { command: 'sh -c "mise run publish"' } },
		{ tool_name: "Bash", tool_input: { command: "mise run 'publish'" } },
		{ tool_name: "Bash", tool_input: { command: 'mise run "publi*"' } },
	];
	for (const payload of commands) assert.notEqual(reason(payload), undefined, JSON.stringify(payload));
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: 'git commit -m "no -n here"' } }), undefined);
	assert.equal(reason({ tool_name: "run_shell_command", tool_input: { command: "mise run check" } }), undefined);
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: "git diff scripts/publish.ts" } }), undefined);
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: 'git commit -m "mise run publish"' } }), undefined);
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: "mise run feature publish-button" } }), undefined);
	assert.equal(
		reason({ tool_name: "Bash", tool_input: { command: 'git commit -am "Fix mise run publish"' } }),
		undefined,
	);
	assert.equal(reason({ tool_name: "Bash", tool_input: { command: "mise run test -- -t publish" } }), undefined);
	assert.match(
		reason({ tool_name: "Bash", tool_input: { command: "node scripts/with-env.ts ROBLOX_PUBLISH_* -- printenv" } }) ??
			"",
		/hands \.env's keys/,
	);
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
	assert.equal(reason({ tool_name: "Read", tool_input: { file_path: "/game/Packages/React.lua" } }), undefined);
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

test("checks only the project's own files that StyLua or Biome formats, not generated ones", () => {
	const files = [
		"/game/src/A.luau",
		"src/A.luau",
		"src/app/client/Start.luau",
		"/game/wally.toml",
		"/game/scripts/test.ts",
		"biome.json",
		"README.md",
		"tests/e2e/shop.luau",
		"/elsewhere/X.luau",
		"../X.luau",
		"Packages/React.lua",
		"DevPackages/_Index/x/init.lua",
		"default.project.json",
		"sourcemap.json",
		"node_modules/x/index.js",
	];
	assert.deepEqual(filesToCheck(files, root, root), [
		"src/A.luau",
		"src/app/client/Start.luau",
		"scripts/test.ts",
		"biome.json",
		"tests/e2e/shop.luau",
	]);
	assert.deepEqual(filesToCheck(["B.luau", "../C.luau"], root, "/game/src"), ["src/B.luau", "C.luau"]);
});

test("reads StyLua's parse errors", () => {
	const output =
		"error: could not format file /game/src/A.luau: error parsing: \n - unexpected token `(` (1:11 to 1:12), expected an expression after `(`\n - unexpected token `=` (1:9 to 1:10), expected an expression\n";
	assert.deepEqual(styluaProblems(output, root), [
		"src/A.luau:1 stylua: unexpected token `(`",
		"src/A.luau:1 stylua: unexpected token `=`",
	]);
	assert.deepEqual(styluaProblems("", root), []);
});

test("reads Selene's diagnostics", () => {
	const output = [
		'{"type":"Diagnostic","severity":"Warning","code":"unused_variable","message":"x is assigned a value, but never used","primary_label":{"filename":"src/A.luau","span":{"start":6,"start_line":0,"start_column":6}},"notes":[],"secondary_labels":[]}',
		'{"type":"Diagnostic","severity":"Error","code":"undefined_variable","message":"`y` is not defined","primary_label":{"filename":"src/A.luau","span":{"start":41,"start_line":2}}}',
		"not json",
	].join("\n");
	assert.deepEqual(seleneProblems(output), [
		"src/A.luau:1 selene(unused_variable): x is assigned a value, but never used",
		"src/A.luau:3 selene(undefined_variable): `y` is not defined",
	]);
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
	const problem = "src/A.luau:3 selene(unused_variable): x is assigned a value, but never used";
	for (const format of ["claude", "copilot", "gemini", "cursor"] as const)
		assert.equal(editedOutput(format, []), undefined);
	assert.equal(editedOutput("cursor", [problem]), undefined);
	const message = (output: object | undefined) => JSON.stringify(output);
	assert.deepEqual(Object.keys(editedOutput("claude", [problem]) ?? {}), ["hookSpecificOutput"]);
	assert.match(
		message(editedOutput("claude", [problem])),
		/"hookEventName":"PostToolUse","additionalContext":".*unused_variable/,
	);
	assert.match(
		message(editedOutput("gemini", [problem])),
		/"hookEventName":"AfterTool","additionalContext":".*unused_variable/,
	);
	assert.match(message(editedOutput("copilot", [problem])), /^\{"additionalContext":".*unused_variable/);
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

test("the guard judges each command of a chain on its own for .env, keeping pipes together", () => {
	const bash = (command: string) => reason({ tool_name: "Bash", tool_input: { command } });
	assert.equal(bash("ls .env .env.example && cat package.json"), undefined);
	assert.equal(bash("test -e .env; grep -rn shop src"), undefined);
	assert.match(bash("ls && cat .env") ?? "", /secret/);
	assert.match(bash("ls .env | xargs cat") ?? "", /secret/);
	assert.match(bash("grep KEY .env || true") ?? "", /secret/);
	assert.match(bash(`python3 -c "import os;print(open('.env').read())"`) ?? "", /secret/);
	assert.match(bash(`node -e "console.log(require('fs').readFileSync('.env','utf8'))"`) ?? "", /secret/);
	assert.match(bash("f=.env; cat $f") ?? "", /secret/);
	assert.match(bash("cat \\\n.env") ?? "", /secret/);
	for (const read of [
		"diff .env .env.example",
		"git diff --no-index .env.example .env",
		"sort .env",
		"nl .env",
		"jq . .env",
		"cp .env /tmp/x",
		"ls .env | xargs cat",
		'ls "x" && cat .env',
		"ls $(cat .env)",
		'test -n "$(cat .env)"',
		"ls `cat .env`",
		"git log -p -- .env",
		"grep KEY .env",
		"grep -n KEY .env .env.example",
		"echo $(cat .env)",
	]) {
		assert.match(bash(read) ?? "", /secret/, read);
	}
	for (const unread of [
		"cp .env.example .env",
		"echo 'KEY=1' >> .env",
		"test -f .env && echo set",
		"git check-ignore .env",
		"touch .env",
		"[ -f .env ] && echo set",
		"echo .env >> .gitignore",
		"printf '.env\\n' >> .gitignore",
		"grep -n .env .gitignore",
		"git rm --cached .env",
		"git log --oneline -- .env",
		"rm .env",
	]) {
		assert.equal(bash(unread), undefined, unread);
	}
});

test("the Claude copy of a hook stands down when Cursor or Copilot runs it, and the hooks find mise by name", {
	skip: process.platform === "win32",
}, () => {
	const home = fs.mkdtempSync(path.join(os.tmpdir(), "run-"));
	const bin = path.join(home, "bin");
	fs.mkdirSync(bin);
	for (const tool of ["sh", "cat", "dirname", "grep"]) {
		const found = spawnSync("sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
		fs.symlinkSync(found, path.join(bin, tool));
	}
	fs.mkdirSync(path.join(home, ".local/bin"), { recursive: true });
	fs.writeFileSync(path.join(home, ".local/bin/mise"), "#!/bin/sh\ncommand -v mise\n", { mode: 0o755 });
	const run = (format: string, payload: object) =>
		spawnSync(path.join(bin, "sh"), [path.join(import.meta.dirname, "run"), "check.ts", format], {
			input: JSON.stringify(payload),
			encoding: "utf8",
			env: { PATH: bin, HOME: home },
		});
	try {
		assert.equal(run("claude", { hook_event_name: "Stop" }).stdout.trim(), path.join(home, ".local/bin/mise"));
		assert.equal(run("claude", { status: "aborted", loop_count: 4, cursor_version: "2.1" }).stdout, "", "Cursor");
		assert.equal(run("claude", { toolName: "bash", toolArgs: "{}" }).stdout, "", "Copilot");
		assert.equal(run("claude", { timestamp: 1764000000000, cwd: "/game" }).stdout, "", "Copilot's agentStop");
		assert.notEqual(run("cursor", { status: "completed", loop_count: 0, cursor_version: "2.1" }).stdout, "");
	} finally {
		fs.rmSync(home, { recursive: true, force: true });
	}
});

test("the guard reads a list of files, as Gemini's read_many_files takes", () => {
	assert.match(reason({ tool_name: "read_many_files", tool_input: { paths: ["src", ".env"] } }) ?? "", /secret/);
	assert.equal(reason({ tool_name: "read_many_files", tool_input: { paths: ["src", ".env.example"] } }), undefined);
	assert.match(reason({ tool_name: "read_many_files", tool_input: { paths: [".env*"] } }) ?? "", /secret/);
	assert.match(
		reason({ tool_name: "read_many_files", tool_input: { paths: ["src"], include: [".env.*"] } }) ?? "",
		/secret/,
	);
});

test("finds the game's files a shell command wrote, not installed or built ones", async () => {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "written-"));
	try {
		for (const file of [
			"src/a.ts",
			"src/deep/b.luau",
			"node_modules/x/c.ts",
			"src/out/d.ts",
			"README.md",
			"world/e.json",
		]) {
			fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
			fs.writeFileSync(path.join(root, file), "old");
		}
		// Apart from the start by more than a coarse filesystem's clock tick, on either side.
		await new Promise((resolve) => setTimeout(resolve, 50));
		const since = Date.now();
		await new Promise((resolve) => setTimeout(resolve, 50));
		for (const file of ["src/deep/b.luau", "node_modules/x/c.ts", "src/out/d.ts", "README.md", "world/e.json"]) {
			fs.writeFileSync(path.join(root, file), "new");
		}
		assert.deepEqual(writtenSince(root, since).sort(), ["README.md", "src/deep/b.luau", "world/e.json"]);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("knows each tool's shell, and leaves commands that run a mise task to the task", () => {
	for (const tool_name of ["Bash", "run_shell_command", "Shell"]) assert.equal(isShell({ tool_name }), true, tool_name);
	assert.equal(isShell({ toolName: "bash" }), true);
	assert.equal(isShell({ tool_name: "Edit" }), false);
	assert.equal(runsTask("cat > src/a.ts <<'EOF'\nx\nEOF\nmise run check"), true);
	assert.equal(runsTask("mise r test -- shop"), true);
	assert.equal(runsTask("sed -i 's/a/b/' src/a.ts"), false);
	assert.equal(
		runsTask("cat > scripts/x.ts <<'EOF'\n// run `mise run check` first\nEOF"),
		false,
		"mise run inside written text",
	);
	assert.equal(movesFiles("git mv src/a.ts src/b.ts"), true);
	assert.equal(movesFiles("mkdir -p x && rm -r src/old"), true);
	assert.equal(movesFiles("cat > src/a.ts"), false);
});

test("no agent tool starts Rogen's stop hook beside the check", () => {
	const folder = path.join(import.meta.dirname, "../..");
	assert.equal(fs.existsSync(path.join(folder, ".agents/hooks/rogen-check.mjs")), false);
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

test("the sourcemap is stale after an edit that adds code, changes the world or the routes", () => {
	const sourcemap = {
		name: "game",
		filePaths: ["game.project.json"],
		children: [
			{ name: "Shop", filePaths: ["src/features/shop/server/Shop.luau"] },
			{ name: "Ui", filePaths: ["src\\app\\client\\Ui.luau"] },
			{ name: "Lobby", filePaths: ["/game/projects/lobby/src/app/server/Main.server.luau"] },
			{ name: "Pkg", filePaths: ["DevPackages/_Index/x/src/Controls/Util.luau"] },
		],
	};
	const known = new Set([
		...sourcemapFiles(sourcemap, ""),
		...sourcemapFiles({ filePaths: ["src/Place.luau"] }, "projects/lobby"),
	]);
	const stale = (...files: string[]) => sourcemapStale(files, known, "/game");
	assert.equal(stale("src/features/shop/server/Shop.luau"), false, "a file it lists");
	assert.equal(stale("src/app/client/Ui.luau"), false, "written on Windows");
	assert.equal(stale("projects/lobby/src/app/server/Main.server.luau"), false, "listed by its absolute path");
	assert.equal(stale("projects/lobby/src/Place.luau"), false, "listed by a place's own sourcemap");
	assert.equal(stale("src/features/shop/server/New.luau"), true, "a new module");
	assert.equal(stale("src/Controls/Util.luau"), true, "a new module whose path ends a package's");
	assert.equal(stale("src/features/shop/shared/Config.model.json"), true, "a new Rojo model");
	assert.equal(stale("world/Workspace/Part.model.json"), true);
	assert.equal(stale("projects/lobby/world/Workspace/Part.model.json"), true);
	assert.equal(stale("default.rogen.json"), true, "the routes");
	assert.equal(stale("tests/e2e/shop.luau", "scripts/x.ts", "biome.json"), false, "outside the game's instances");
	assert.equal(sourcemapStale(["src/New.luau"], new Set(), "/game"), false, "no sourcemap to update yet");
});

test("a commit message or a plain read doesn't trip the guard's rules for tools", () => {
	const bash = (command: string) => guardReason({ tool_name: "Bash", tool_input: { command } }, "/game", "/game");
	for (const allowed of [
		'git commit -m "Install with pnpm, not npm install"',
		'git commit -m "Stop using npx for tools"',
		"git config --get core.hooksPath",
		"git config core.hooksPath .githooks",
		"grep -rn LINT_STAGED scripts",
	]) {
		assert.equal(bash(allowed), undefined, allowed);
	}
	for (const blocked of [
		"git config core.hooksPath /dev/null",
		"git -c core.hooksPath=/tmp commit -m x",
		"git config --unset core.hooksPath",
		"HUSKY=0 git commit -m x",
		"npm install lodash",
		"npx eslint src",
	]) {
		assert.notEqual(bash(blocked), undefined, blocked);
	}
});
