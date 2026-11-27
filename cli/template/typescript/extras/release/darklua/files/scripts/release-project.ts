import fs from "node:fs";

const toDist = (mount: string) => mount.replace(/^((?:\.\.\/)*)out(?=\/|$)/, "$1dist");

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
	console.error("release-project: game.project.json mounts nothing from out/, so the release would hold no code");
	process.exit(1);
}
fs.writeFileSync("release.project.json", `${JSON.stringify(release, undefined, "\t")}\n`);
