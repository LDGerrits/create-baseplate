// A symbolic link that git checked out as a plain file holding its target, as git does on Windows
// when symbolic links are off (core.symlinks false, or no permission to create them).
import fs from "node:fs";
import path from "node:path";

/**
 * Turns `link` back into a link to the folder its text names, if it's such a file: a junction on
 * Windows (which needs no special permission), else a symbolic link; a copy when neither works.
 * Returns what it made, or undefined when `link` was fine.
 */
export function restoreLink(link: string): "junction" | "link" | "copy" | undefined {
	let stat: fs.Stats;
	try {
		stat = fs.lstatSync(link);
	} catch {
		return undefined;
	}
	if (!stat.isFile() || stat.size > 1024) return undefined;
	const target = fs.readFileSync(link, "utf8").trim();
	const folder = path.resolve(path.dirname(link), target);
	if (target === "" || /[\r\n]/.test(target) || !fs.statSync(folder, { throwIfNoEntry: false })?.isDirectory()) {
		return undefined;
	}
	fs.rmSync(link);
	try {
		if (process.platform === "win32") {
			fs.symlinkSync(folder, link, "junction");
			return "junction";
		}
		fs.symlinkSync(target, link, "dir");
		return "link";
	} catch {
		fs.cpSync(folder, link, { recursive: true });
		return "copy";
	}
}
