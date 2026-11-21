import { spawnSync } from "node:child_process";

export const isMiseInstalled = () =>
	spawnSync("mise", ["--version"], { shell: process.platform === "win32" }).status === 0;

/**
 * Installs the project's pinned tools and packages with mise: `mise install` (Node, pnpm, Rojo,
 * Sloptor and the rest), `pnpm install` (which adds add-ons' packages to the lockfile), then
 * `mise run install` (packages, generated files, hooks). Returns the
 * failing step's output, if any.
 */
export function installDependencies(dir: string, quiet: boolean): string | undefined {
	for (const args of [
		["trust", "--quiet", "."],
		["install"],
		["exec", "--", "pnpm", "install", "--silent"],
		["run", "install"],
	]) {
		const run = spawnSync("mise", args, {
			cwd: dir,
			encoding: "utf8",
			shell: process.platform === "win32",
			stdio: quiet ? "pipe" : ["ignore", "inherit", "inherit"],
		});
		if (run.status !== 0) return `mise ${args.join(" ")} failed${quiet ? `:\n${run.stdout}${run.stderr}` : ""}`;
	}
	return undefined;
}
