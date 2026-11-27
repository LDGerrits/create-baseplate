import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const git = (dir: string, ...args: string[]) =>
	spawnSync("git", ["rev-parse", ...args], { cwd: dir, encoding: "utf8" });

export const canonical = (dir: string) => fs.realpathSync.native(path.resolve(dir));

export function mainCheckout(dir: string): string | undefined {
	const common = git(dir, "--path-format=absolute", "--git-common-dir");
	const own = git(dir, "--path-format=absolute", "--git-dir");
	if (common.status !== 0 || own.status !== 0) return undefined;
	const [commonDir, ownDir] = [common.stdout.trim(), own.stdout.trim()];
	if (canonical(commonDir) === canonical(ownDir) || path.basename(commonDir) !== ".git") return undefined;
	const folder = path.join(path.dirname(commonDir), git(dir, "--show-prefix").stdout.trim());
	return fs.existsSync(folder) ? canonical(folder) : undefined;
}
