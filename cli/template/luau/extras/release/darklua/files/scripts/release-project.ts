// Writes release.project.json: game.project.json with the code read from dist/, where
// `mise run release` puts what Darklua processed (scripts/darklua.ts), in place of src/ (or
// projects/), Packages/ and ServerPackages/. The world and DevPackages/ are mounted as they are. Runs in each place.
// Rogen could write it from a second config, but that file would repeat default.rogen.json's
// routes and tree; this keeps default.rogen.json the one source.
import fs from "node:fs";
import path from "node:path";

// Mounts are relative to the place's folder; each-place.ts gives the repo root as ROOT.
const ROOT = path.resolve(process.env.ROOT ?? process.cwd());
const PROCESSED = /^(src|projects|Packages|ServerPackages)(\/|$)/;
/** The mount's copy under dist/, as a path from the place's folder, or the mount as it is. */
const toDist = (mount: string) => {
	const fromRoot = path.relative(ROOT, path.resolve(mount)).split(path.sep).join("/");
	if (!PROCESSED.test(fromRoot)) return mount;
	return path.relative(process.cwd(), path.join(ROOT, "dist", fromRoot)).split(path.sep).join("/");
};

let moved = 0;
const rewrite = (node: unknown): unknown => {
	if (Array.isArray(node) || node === null || typeof node !== "object") return node;
	return Object.fromEntries(
		Object.entries(node).map(([key, value]) => {
			if (key !== "$path") return [key, rewrite(value)];
			const mount = typeof value === "string" ? value : (value as { optional: string }).optional;
			const released = toDist(mount);
			if (released !== mount) moved++;
			return [key, typeof value === "string" ? released : { ...value, optional: released }];
		}),
	);
};

const release = rewrite(JSON.parse(fs.readFileSync("game.project.json", "utf8")));
if (moved === 0) {
	console.error("release-project: game.project.json mounts nothing from src/, so the release would hold no code");
	process.exit(1);
}
fs.writeFileSync("release.project.json", `${JSON.stringify(release, undefined, "\t")}\n`);
