// Processes the code players run with Darklua into dist/, by the rules in .darklua.json: the game's
// code in src/ and the Wally packages it ships, Packages/ and ServerPackages/. DevPackages/ (Jest,
// UI Labs) only run in tests and stories, so they stay as they are. Each folder lands at the same
// path under dist/; .darklua.json's loaders copy every other file unchanged, so the Rojo files
// (init.meta.json, *.model.json, a package's default.project.json) still describe the same instances,
// and leave out the UI stories, which only Studio and `mise run ui` use.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FOLDERS = ["src", "Packages", "ServerPackages"];

fs.rmSync("dist", { recursive: true, force: true });
for (const folder of FOLDERS) {
	if (!fs.existsSync(folder)) continue;
	const darklua = spawnSync("darklua", ["process", folder, path.join("dist", folder)], {
		stdio: "inherit",
		shell: process.platform === "win32",
	});
	if (darklua.error) {
		console.error(`darklua: ${darklua.error.message}`);
		process.exit(1);
	}
	if (darklua.status !== 0) process.exit(darklua.status ?? 1);

	// The dense output drops every comment, and with them the directives at the top of a module,
	// such as `--!native` and `--!optimize 2`, which change how Roblox runs it. Put them back.
	for (const file of fs.readdirSync(folder, { recursive: true, encoding: "utf8" })) {
		const processed = path.join("dist", folder, file);
		// Stories aren't released: .darklua.json skips them.
		if (!/\.luau?$/.test(file) || !fs.existsSync(processed)) continue;
		const lines = fs.readFileSync(path.join(folder, file), "utf8").split(/\r?\n/);
		const code = lines.findIndex((line) => line.trim() !== "" && !line.startsWith("--"));
		const directives = lines.slice(0, code === -1 ? lines.length : code).filter((line) => /^--!\w/.test(line));
		if (directives.length === 0) continue;
		fs.writeFileSync(processed, `${directives.join("\n")}\n${fs.readFileSync(processed, "utf8")}`);
	}
}
