// Processes the compiled code in out/ into dist/ with Darklua, by the rules in .darklua.json.
// Darklua turns every file it reads into a Lua module, data and Rojo files too (init.meta.json
// becomes init.meta.lua), so those are copied over as they are, in place of what it made of them.
// UI stories, and their source maps, stay out of the release: only Studio and `mise run ui` use them, and rur's sweep, which
// reads every story under the game's folder, would otherwise render the processed copies too.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

fs.rmSync("dist", { recursive: true, force: true });
const darklua = spawnSync("darklua", ["process", "out", "dist"], { stdio: "inherit" });
if (darklua.status !== 0) process.exit(darklua.status ?? 1);

const isCode = (file: string) => file.endsWith(".lua") || file.endsWith(".luau");
for (const file of fs.readdirSync("out", { recursive: true, encoding: "utf8" })) {
	const from = path.join("out", file);
	if (isCode(file) || !fs.statSync(from).isFile()) continue;
	const made = path.join("dist", path.dirname(file), `${path.parse(file).name}.lua`);
	if (!fs.existsSync(path.join("out", path.dirname(file), `${path.parse(file).name}.lua`))) {
		fs.rmSync(made, { force: true });
	}
	// Darklua skips files it can't read at all, such as a place file, so their folder may be missing.
	fs.mkdirSync(path.join("dist", path.dirname(file)), { recursive: true });
	fs.copyFileSync(from, path.join("dist", file));
}

const isStory = (file: string) => /\.story(book)?\.luau?(\.map)?$/.test(file);
for (const file of fs.readdirSync("dist", { recursive: true, encoding: "utf8" })) {
	if (isStory(file)) fs.rmSync(path.join("dist", file));
}
