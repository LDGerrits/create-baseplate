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

const args = process.argv.slice(2);

// `mise run ui -- --story <story> --actions '<json>'`: render one story after clicks or key presses,
// and list what it printed. `mise run ui -- diff <git ref> --story <story>`: render the story at that
// commit and now, and show what changed.
const story = args.indexOf("--story");
if (story !== -1) {
	const name = path.basename(args[story + 1] ?? "story", ".story.tsx").replace(/\.story\.luau$/, "");
	// Accept the source path; rur renders the compiled story.
	const compiled = (args[story + 1] ?? "").replace(/^src\//, "out/").replace(/\.story\.tsx$/, ".story.luau");
	const rest = args.filter((_, i) => i !== story && i !== story + 1);
	const diff = rest[0] === "diff";
	const dir = `build/ui-${diff ? "diff" : "try"}/${name}`;
	fs.rmSync(dir, { recursive: true, force: true });
	const command = diff
		? ["diff", "--git-ref", rest[1] ?? "HEAD", "--story", compiled, "--out", dir, ...rest.slice(2)]
		: ["render", "--story", compiled, "--dir", dir, "--time", "1", ...rest];
	const run = spawnSync("rur-native", [...command, "--rojo", "game.project.json", "--viewport", "800x600"], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (diff) {
		console.log(`${run.stdout}${run.stderr}`.trim());
		console.log(`Pictures: ${dir}/before, ${dir}/after, ${dir}/diff.png`);
		process.exit(run.status ?? 1);
	}
	if (run.status !== 0) {
		console.log(`${run.stdout}${run.stderr}`.trim());
		process.exit(1);
	}
	const scene = JSON.parse(fs.readFileSync(path.join(dir, "scene.json"), "utf8")) as {
		diagnostics: { output?: { kind: string; message: string; time: number }[] };
	};
	for (const line of scene.diagnostics.output ?? []) {
		console.log(`[${line.time.toFixed(2)}s] ${line.kind === "print" ? "" : `${line.kind}: `}${line.message}`);
	}
	console.log(`Picture: ${path.join(dir, "render.png")}`);
	process.exit(0);
}

fs.rmSync(OUT, { recursive: true, force: true });
const sweep = spawnSync(
	"rur-native",
	["sweep", "--rojo", "game.project.json", "--out", OUT, "--viewport", "800x600", ...args],
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
	const name = record.story.replace(/^(.*\/)?out\//, "").replace(/\.story\.luau$/, "");
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
