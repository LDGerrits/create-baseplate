// The CLI at a terminal: its questions, answered as a person would at the keyboard.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { CLI, tempDir } from "./helpers.ts";

// A person at a terminal: `script` gives the CLI one, sized so prompts draw. Skipped where `script` isn't there.
const hasScript = spawnSync("script", ["--version"]).status === 0;
test("rejects a bad name before asking anything", { skip: !hasScript }, () => {
	const cwd = tempDir();
	const run = spawnSync("script", ["-qec", `stty cols 120 rows 40; node ${CLI} "Bad Name"`, "/dev/null"], {
		cwd,
		encoding: "utf8",
		timeout: 10_000,
	});
	assert.equal(run.status, 1, "exits at once, without waiting for answers");
	assert.match(run.stdout, /can't name the game/);
	assert.doesNotMatch(run.stdout, /Which UI library/);
});

/** One step of a person's session: wait for `waitFor` to show, then type `send`. */
interface Turn {
	waitFor: RegExp;
	send: string;
}

/**
 * Runs the CLI at a terminal and types each answer once its question shows, so a slow machine only
 * makes the test slower, never wrong. Returns what the terminal showed once the CLI exits. A question
 * that never shows fails with what was shown so far.
 */
const atTerminal = (cwd: string, args: string, turns: Turn[], { cols = 120, timeout = 20_000 } = {}) =>
	new Promise<{ shown: string; status: number | null }>((resolve, reject) => {
		const child = spawn("script", ["-qec", `stty cols ${cols} rows 40; node ${CLI} ${args}`, "/dev/null"], { cwd });
		let raw = "";
		let seen = 0;
		let next = 0;
		const shown = () => stripVTControlCharacters(raw);
		const timer = setTimeout(() => {
			child.kill();
			const waiting = turns[next]?.waitFor ?? "the CLI to end";
			reject(new Error(`timed out after ${timeout} ms waiting for ${waiting}. Shown so far:\n${shown()}`));
		}, timeout);
		child.stdout.on("data", (chunk: Buffer) => {
			raw += chunk.toString("utf8");
			// Each question is looked for only after the one before it: its text can repeat as the screen redraws.
			for (let turn = turns[next]; turn !== undefined; turn = turns[next]) {
				const at = shown().slice(seen).search(turn.waitFor);
				if (at === -1) return;
				seen = shown().length;
				next++;
				child.stdin.write(turn.send);
			}
		});
		child.stdin.on("error", () => {});
		child.on("close", (status) => {
			clearTimeout(timer);
			resolve({ shown: shown(), status });
		});
	});

test("takes a folder typed at the prompt that only --name can name", { skip: !hasScript }, async () => {
	const cwd = tempDir();
	const { shown } = await atTerminal(cwd, "--name coin-rush", [
		{ waitFor: /What will your game be called/, send: "Coin Rush\r" },
		{ waitFor: /Which language/, send: "\u0003" },
	]);
	assert.doesNotMatch(shown, /can't name the game/);
});

test("refuses a folder with files at the prompt, before the other questions", { skip: !hasScript }, async () => {
	const cwd = tempDir();
	fs.mkdirSync(path.join(cwd, "taken"));
	fs.writeFileSync(path.join(cwd, "taken/file.txt"), "");
	// The question stays open for another answer, as it should; Ctrl+C then cancels, as a person would.
	const { shown } = await atTerminal(cwd, "", [
		{ waitFor: /What will your game be called/, send: "taken\r" },
		{ waitFor: /already has files in it/, send: "\u0003" },
	]);
	assert.doesNotMatch(shown, /Which language/);
});

test("asks the project's shape, then offers the recommended stack in one answer", { skip: !hasScript }, async () => {
	const cwd = tempDir();
	// The name, then Enter for Luau, one place, the whole place and the recommended stack.
	const { shown, status } = await atTerminal(
		cwd,
		"--no-install --no-git",
		[
			{ waitFor: /What will your game be called/, send: "coin-rush\r" },
			{ waitFor: /Which language/, send: "\r" },
			{ waitFor: /One place, or several/, send: "\r" },
			{ waitFor: /Should Rojo manage the whole place/, send: "\r" },
			{ waitFor: /Which libraries and tools/, send: "\r" },
		],
		{ cols: 160 },
	);
	assert.equal(status, 0, shown);
	assert.ok(shown.indexOf("One place, or several") < shown.indexOf("Which libraries and tools"), "shape first");
	assert.match(
		shown,
		/The recommended ones \(Vide and Charm; no player data, entities, asset uploads or release builds yet\)/,
	);
	assert.doesNotMatch(shown, /Which library for client state/, "the recommended stack skips the stack's questions");
	const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "coin-rush/package.json"), "utf8"));
	assert.equal(pkg.baseplate.language, "luau");
	assert.equal(pkg.baseplate.addOns.state, "charm");
	assert.equal(pkg.baseplate.addOns.places, "single");
});

test("refuses flags that can't go together at the prompt, before asking a question with no choice", {
	skip: !hasScript,
}, async () => {
	const cwd = tempDir();
	// With a folder: every language that takes the flags conflicts, so it refuses before asking anything.
	const withFolder = await atTerminal(cwd, "z/g --ui vide --state reflex --no-install --no-git", []);
	assert.equal(withFolder.status, 1);
	assert.match(withFolder.shown, /Reflex has no Vide binding/);
	assert.doesNotMatch(withFolder.shown, /TypeError|Which language/);
	// Without one: it asks the name and the language, then refuses.
	const { shown } = await atTerminal(cwd, "--ui vide --state reflex --no-install --no-git", [
		{ waitFor: /What will your game be called/, send: "g2\r" },
		{ waitFor: /Which language/, send: "\r" },
	]);
	assert.match(shown, /Reflex has no Vide binding/);
	assert.doesNotMatch(shown, /TypeError|One place, or several/);
});
