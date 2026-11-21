// Copies the template into dist/template, the folder the published CLI copies projects from.
// Only files git tracks or would track: no node_modules, build output or .env. npm doesn't pack
// .gitignore files or symbolic links, so .gitignore becomes _gitignore and links go in a list.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SOURCE = "template";
const OUT = "dist/template";

const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", SOURCE], {
	encoding: "utf8",
});
if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);

fs.rmSync(OUT, { recursive: true, force: true });
const links: Record<string, Record<string, string>> = {};
for (const file of listed.stdout.split("\0").filter((f) => f !== "" && fs.existsSync(f))) {
	const relative = path.relative(SOURCE, file);
	const [kind = "", ...rest] = relative.split(path.sep);
	const inKind = rest.join("/");
	const stat = fs.lstatSync(file);
	if (stat.isSymbolicLink()) {
		const top = kind === "base" ? "base" : path.join(kind, rest[0] ?? "");
		const within = path.relative(path.join(SOURCE, top), file).split(path.sep).join("/");
		links[top] ??= {};
		links[top][within] = fs.readlinkSync(file);
		continue;
	}
	const name = path.basename(file) === ".gitignore" ? "_gitignore" : path.basename(file);
	// A file directly in template/, such as its LICENSE, stays there.
	const to = rest.length === 0 ? path.join(OUT, name) : path.join(OUT, kind, path.dirname(inKind), name);
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(file, to);
	fs.chmodSync(to, stat.mode);
}
for (const [top, list] of Object.entries(links)) {
	fs.writeFileSync(path.join(OUT, top, "_symlinks.json"), `${JSON.stringify(list, undefined, "\t")}\n`);
}
if (!fs.existsSync(path.join(OUT, "base", "_symlinks.json"))) {
	fs.writeFileSync(path.join(OUT, "base", "_symlinks.json"), "{}\n");
}
console.log(`Copied the template to ${OUT}`);
