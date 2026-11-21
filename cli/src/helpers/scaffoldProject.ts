import fs from "node:fs";
import path from "node:path";
import { SYMLINKS_FILE, TEMPLATE_BASE } from "../consts.ts";

/** Copies the base template into `dir`, which must be missing or empty. */
export function scaffoldProject(dir: string) {
	if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
		throw new Error(`${dir} already has files in it. Pick a new folder, or empty this one.`);
	}
	fs.cpSync(TEMPLATE_BASE, dir, { recursive: true });

	// npm drops .gitignore files from packages, so the template ships them as _gitignore.
	for (const file of fs.readdirSync(dir, { recursive: true, encoding: "utf8" })) {
		if (path.basename(file) === "_gitignore") {
			fs.renameSync(path.join(dir, file), path.join(dir, path.dirname(file), ".gitignore"));
		}
	}

	// npm doesn't pack symbolic links either, so they're listed in a file and made here.
	const listFile = path.join(dir, SYMLINKS_FILE);
	const links = JSON.parse(fs.readFileSync(listFile, "utf8")) as Record<string, string>;
	fs.rmSync(listFile);
	for (const [link, target] of Object.entries(links)) {
		const at = path.join(dir, link);
		try {
			fs.symlinkSync(target, at);
		} catch {
			// Windows without the right to make symbolic links: copy what it points at.
			fs.cpSync(path.resolve(path.dirname(at), target), at, { recursive: true });
		}
	}
}
