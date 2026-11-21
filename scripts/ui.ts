// Renders every UI story (`*.story.tsx`) offline with rur and lists each picture, so you can look
// at it. Run it through `mise run ui`, which compiles first. Extra arguments go to `rur-native sweep`,
// such as `--filter clicker-button`. Fails when a story doesn't render cleanly.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = "build/ui";

// rur draws text with Roblox Studio's fonts. From WSL it can't find Studio, so point it at the newest
// Windows install's content folder.
if (!process.env.RUR_ROBLOX_CONTENT && fs.existsSync("/mnt/c/Users")) {
	const installs = fs
		.readdirSync("/mnt/c/Users")
		.map((user) => `/mnt/c/Users/${user}/AppData/Local/Roblox/Versions`)
		.filter((dir) => fs.existsSync(dir))
		.flatMap((dir) => fs.readdirSync(dir).map((version) => path.join(dir, version)))
		.filter((dir) => fs.existsSync(path.join(dir, "RobloxStudioBeta.exe")))
		.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	const newest = installs[0];
	if (newest !== undefined) process.env.RUR_ROBLOX_CONTENT = path.join(newest, "content");
}

// Without Studio's fonts rur draws no text; `rur-native doctor` says when it can't find them.
const doctor = spawnSync("rur-native", ["doctor"], { encoding: "utf8" });
const noStudio = `${doctor.stdout}${doctor.stderr}`.split("\n").find((line) => /^!\s*studio/.test(line));
if (noStudio) {
	console.log(`rur can't draw text: ${noStudio.replace(/^!\s*studio\s*/, "")}`);
	process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
const sweep = spawnSync(
	"rur-native",
	["sweep", "--rojo", "game.project.json", "--out", OUT, "--viewport", "800x600", ...process.argv.slice(2)],
	{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

let report;
try {
	report = JSON.parse(fs.readFileSync(path.join(OUT, "report.json"), "utf8"));
} catch {
	console.log(`rur sweep wrote no report (exit ${sweep.status})\n${`${sweep.stdout}${sweep.stderr}`.trim()}`);
	process.exit(1);
}

if (report.records.length === 0) {
	console.log("No stories found. Add a `<component>.story.tsx` beside a component (see UI in AGENTS.md).");
	process.exit(0);
}

let failed = 0;
for (const record of report.records) {
	const name = record.story.replace(/^out\//, "").replace(/\.story\.luau$/, "");
	const picture = path.join(OUT, record.out, "render.png");
	const missingFonts = record.missingFonts ?? [];
	if (record.clean && missingFonts.length === 0) {
		console.log(`✓ ${name}: ${picture}`);
		continue;
	}
	failed++;
	const reason = record.failure ?? (record.clean ? `no font to draw ${missingFonts.join(", ")}` : "not clean");
	console.log(`✗ ${name} (${record.status}): ${reason}`);
	for (const error of record.errors ?? []) console.log(`  ${String(error).replaceAll("\n", "\n  ")}`);
	if (fs.existsSync(picture)) console.log(`  picture: ${picture}`);
}
console.log(`Full report: ${path.join(OUT, "summary.md")}`);
process.exit(failed > 0 ? 1 : 0);
