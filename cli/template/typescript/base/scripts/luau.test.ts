import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { luauFolders } from "./luau.ts";

function game(files: string[]) {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "luau-folders-"));
	for (const file of files) {
		fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		fs.writeFileSync(path.join(root, file), "");
	}
	return root;
}

test("finds no folder in a game without Luau files", () => {
	const root = game(["src/app/server/main.server.ts", "tests/e2e/.gitkeep", "out/app/server/main.server.luau"]);
	assert.deepEqual(luauFolders(root, ["src", "tests"]), []);
});

test("finds the folders that hold a .luau file, and not the compiler's output", () => {
	const root = game(["src/game/mod/server/mod.luau", "tests/e2e/shop.luau", "out/a.luau", "scripts/check-place.luau"]);
	assert.deepEqual(luauFolders(root, ["src", "tests"]), ["src", "tests"]);
	assert.deepEqual(luauFolders(root, ["src"]), ["src"]);
});

test("looks in each place of a multi-place game and its shared code", () => {
	const root = game([
		"projects/common/src/mod.luau",
		"projects/lobby/tests/e2e/lobby.luau",
		"projects/game/src/app/x.ts",
	]);
	assert.deepEqual(luauFolders(root, ["src", "tests"]), [
		path.join("projects", "common", "src"),
		path.join("projects", "lobby", "tests"),
	]);
});
