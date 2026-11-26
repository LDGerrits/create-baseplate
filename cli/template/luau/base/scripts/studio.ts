// Roblox Studio on Windows, seen from WSL: the tools that need it (rur's fonts, jest-roblox) can't
// find it there by themselves.
import fs from "node:fs";
import path from "node:path";

/** The newest Windows Studio install's folder, from WSL; undefined elsewhere or without one. */
export function windowsStudio(): string | undefined {
	if (!fs.existsSync("/mnt/c/Users")) return undefined;
	return fs
		.readdirSync("/mnt/c/Users")
		.map((user) => `/mnt/c/Users/${user}/AppData/Local/Roblox/Versions`)
		.filter((dir) => fs.existsSync(dir))
		.flatMap((dir) => fs.readdirSync(dir).map((version) => path.join(dir, version)))
		.filter((dir) => fs.existsSync(path.join(dir, "RobloxStudioBeta.exe")))
		.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

/** What the tools need to know of that install, for the variables the caller doesn't set itself. */
export function studioDefaults(): Record<string, string> {
	const studio = windowsStudio();
	if (studio === undefined) return {};
	return {
		RUR_ROBLOX_CONTENT: path.join(studio, "content"),
		JEST_ROBLOX_STUDIO_PATH: path.join(studio, "RobloxStudioBeta.exe"),
		JEST_ROBLOX_PLUGINS_DIR: path.join(studio, "..", "..", "Plugins"),
	};
}
