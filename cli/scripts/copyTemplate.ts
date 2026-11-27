// npm doesn't pack .gitignore files or symbolic links, so .gitignore becomes _gitignore and links go in a list.
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
const languages = new Set<string>();
for (const file of listed.stdout.split("\0").filter((f) => f !== "" && fs.existsSync(f))) {
	const relative = path.relative(SOURCE, file);
	const parts = relative.split(path.sep);
	if (parts.length > 2) languages.add(parts[0] ?? "");
	const stat = fs.lstatSync(file);
	if (stat.isSymbolicLink()) {
		const top = parts.slice(0, parts[1] === "base" ? 2 : 4).join("/");
		const within = path.relative(path.join(SOURCE, top), file).split(path.sep).join("/");
		links[top] ??= {};
		links[top][within] = fs.readlinkSync(file);
		continue;
	}
	const name = path.basename(file) === ".gitignore" ? "_gitignore" : path.basename(file);
	const to = path.join(OUT, path.dirname(relative), name);
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(file, to);
	fs.chmodSync(to, stat.mode);
}
for (const [top, list] of Object.entries(links)) {
	fs.writeFileSync(path.join(OUT, top, "_symlinks.json"), `${JSON.stringify(list, undefined, "\t")}\n`);
}
for (const language of languages) {
	const list = path.join(OUT, language, "base", "_symlinks.json");
	if (!fs.existsSync(list)) fs.writeFileSync(list, "{}\n");
}
console.log(`Copied the template to ${OUT}`);
