import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const places = fs.existsSync("projects") ? fs.readdirSync("projects").sort() : [];
const FOLDERS = [
	"src",
	...places.map((place) => path.posix.join("projects", place, "src")),
	"Packages",
	"ServerPackages",
];

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
		const leftOutOfTheRelease = !fs.existsSync(processed);
		if (!/\.luau?$/.test(file) || leftOutOfTheRelease) continue;
		const lines = fs.readFileSync(path.join(folder, file), "utf8").split(/\r?\n/);
		const code = lines.findIndex((line) => line.trim() !== "" && !line.startsWith("--"));
		const directives = lines.slice(0, code === -1 ? lines.length : code).filter((line) => /^--!\w/.test(line));
		if (directives.length === 0) continue;
		fs.writeFileSync(processed, `${directives.join("\n")}\n${fs.readFileSync(processed, "utf8")}`);
	}
}
