// Renders every UI story (`*.story.tsx`) offline with rur and lists each picture, so you can look
// at it. Run it through `mise run ui`, which compiles first. Extra arguments go to `rur-native sweep`,
// such as `--filter shop-button`. Fails when a story doesn't render cleanly.
// With --check, as `mise run check` runs it: prints only the stories that fail. Without Studio's
// fonts it renders without text, so a story that crashes still fails, even in CI.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Paths are printed from the repo root, so a place's pictures read projects/<place>/build/....
const shown = (file: string) => path.relative(process.env.ROOT ?? process.cwd(), path.resolve(file));

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

const check = process.argv.includes("--check");
const args = process.argv.slice(2).filter((arg) => arg !== "--check");
/** What a person reads at `mise run ui`; the check prints only what fails. */
const say = check ? () => {} : (line: string) => console.log(line);

// Without Studio's fonts rur draws no text; `rur-native doctor` says when it can't find them. The
// pictures still show layout, size and overlap, so render them anyway, as in a cloud session.
const doctor = spawnSync("rur-native", ["doctor"], { encoding: "utf8" });
const noStudio = `${doctor.stdout}${doctor.stderr}`.split("\n").find((line) => /^!\s*studio/.test(line));
if (noStudio && !check) {
	console.log(`! rur can't draw text, so the pictures have none: ${noStudio.replace(/^!\s*studio\s*/, "")}`);
	console.log("  Judge layout, size and overlap from them.");
}

// `mise run ui -- --story <story> --actions '<json>'`: render one story after clicks or key presses,
// and list what it printed. `mise run ui -- diff <git ref> --story <story>`: render the story at that
// commit and now, and show what changed.
const story = args.indexOf("--story");
if (story !== -1) {
	const name = path.basename(args[story + 1] ?? "story", ".story.tsx").replace(/\.story\.luau$/, "");
	// Accept the source path; rur renders the compiled story. In a multi-place game the path is from
	// the repo root (projects/...), each place compiles to $ROOT/out/<place>, and a place that
	// doesn't hold the story skips it.
	const given = args[story + 1] ?? "";
	const root = process.env.ROOT ?? process.cwd();
	const place = process.env.PLACE ?? "";
	const inProjects = path.relative(path.join(root, "projects"), path.resolve(root, given));
	const multi = fs.existsSync(path.join(root, "projects")) && !inProjects.startsWith("..");
	if (multi && !["common", place].includes(inProjects.split(path.sep)[0] ?? "")) process.exit(0);
	const compiled = (multi ? path.join(root, "out", place, inProjects) : given.replace(/^src\//, "out/")).replace(
		/\.story\.tsx$/,
		".story.luau",
	);
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
		console.log(`Pictures: ${shown(dir)}/before, ${shown(dir)}/after, ${shown(dir)}/diff.png`);
		process.exit(run.status ?? 1);
	}
	if (run.status !== 0) {
		console.log(`${run.stdout}${run.stderr}`.trim());
		process.exit(1);
	}
	const scene = JSON.parse(fs.readFileSync(path.join(dir, "scene.json"), "utf8")) as {
		diagnostics: { output?: { kind: string; message: string; time: number }[] | Record<string, never> };
		nodes?: { class: string; name: string; path: string }[];
	};
	// rur writes an empty object, not an empty list, when the story printed nothing.
	const output = scene.diagnostics.output;
	const lines = Array.isArray(output) ? output : [];
	for (const line of lines) {
		// rur's hint names a tool of its own repo; the node list below says the same here.
		const message = line.message.replace(/; `node cli\/inspect\.mjs tree <render dir>` lists the node paths$/, "");
		console.log(`[${line.time.toFixed(2)}s] ${line.kind === "print" ? "" : `${line.kind}: `}${message}`);
	}
	console.log(`Picture: ${shown(path.join(dir, "render.png"))}`);
	const failedAction = lines.some((line) => line.kind === "error" && line.message.includes("--actions"));
	if (failedAction) {
		// A node is named after its React key, or its Name; the story's own frames come first.
		const nodes = (scene.nodes ?? []).filter((node) => !["RURStory", "StoryTarget"].includes(node.name));
		console.log(`Nodes an action can name: ${nodes.map((node) => `${node.name} (${node.class})`).join(", ")}`);
	}
	process.exit(lines.some((line) => line.kind === "error") ? 1 : 0);
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
	const filtered = args.some((arg) => arg === "--filter" || arg.startsWith("--filter="));
	if (filtered && !fs.existsSync(path.join(process.env.ROOT ?? ".", "projects"))) {
		say("No story matches the filter; `mise run ui` renders them all.");
		process.exit(1);
	}
	say("No stories found. Add a `<component>.story.tsx` beside a component (see UI in AGENTS.md).");
	process.exit(0);
}

// Without a GPU or a software renderer (Mesa's Vulkan driver on Linux), rur can't draw at all. In CI
// that's a setup error; elsewhere, as in a cloud session, the check says so and goes on.
const noAdapter = (report.records as { failure?: string | null }[]).some((record) =>
	/graphics adapter|WGPU adapter/i.test(record.failure ?? ""),
);
if (check && noAdapter) {
	const message = "rur found no graphics adapter, so no story was rendered. On Linux, install mesa-vulkan-drivers.";
	if (process.env.CI) {
		console.log(`✗ ${message}`);
		process.exit(1);
	}
	console.log(`! ${message}`);
	process.exit(0);
}

let failed = 0;
for (const record of report.records) {
	const name = record.story
		.replaceAll("\\", "/")
		.replace(/^(.*\/)?out\//, "")
		.replace(/\.story\.luau$/, "");
	const picture = path.join(OUT, record.out, "render.png");
	// Without Studio, stories render without fonts; only a story that breaks fails then.
	const missingFonts = check || noStudio ? [] : (record.missingFonts ?? []);
	if (record.clean && missingFonts.length === 0) {
		say(`✓ ${name}: ${shown(picture)}${noStudio ? " (no text)" : ""}`);
		continue;
	}
	failed++;
	const reason = record.failure ?? (record.clean ? `no font to draw ${missingFonts.join(", ")}` : "not clean");
	console.log(`✗ story ${name} (${record.status}): ${reason}`);
	// What the story's code raised, such as `Error: boom`; the errors below are often only the
	// scheduler's trace around it.
	for (const message of record.warningMessages ?? []) console.log(`  ${String(message).replaceAll("\n", "\n  ")}`);
	for (const error of record.errors ?? []) console.log(`  ${String(error).replaceAll("\n", "\n  ")}`);
	if (fs.existsSync(picture)) console.log(`  picture: ${shown(picture)}`);
}
if (check && failed > 0) console.log("Render one story to see it: mise run ui -- --story <path>.story.tsx");
if (!check || failed > 0) console.log(`Full report: ${shown(path.join(OUT, "summary.md"))}`);
process.exit(failed > 0 ? 1 : 0);
