// Runs a command with only the named variables from .env, so each task's tools get the keys that
// task needs and no others: the tests never see the publish key, nor publishing the test key.
//
//   node scripts/with-env.ts <NAME>[,<NAME>...] -- <command> [args...]
//
// It reads the .env in the folder it runs in, the project's root for mise's tasks; in a git worktree
// without one, the main checkout's, so worktrees share the keys without copies. A name ending in
// `*` takes every variable that starts with what comes before it. A variable already set in the
// environment, as in CI, wins over .env. This keeps keys from tools that don't need them;
// it doesn't keep them from code that runs inside the task.
import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import spawn from "cross-spawn";
import { mainCheckout } from "./worktree.ts";

/** The variables of `file` (the text of a .env) that `names` pick. */
export function pick(file: string, names: string[]): Record<string, string> {
	const picked: Record<string, string> = {};
	for (const [key, value] of Object.entries(util.parseEnv(file))) {
		const wanted = names.some((name) => (name.endsWith("*") ? key.startsWith(name.slice(0, -1)) : key === name));
		if (wanted && value !== undefined) picked[key] = value;
	}
	return picked;
}

/** The .env to read in `dir`: its own, or in a git worktree without one, the main checkout's. */
export function envFile(dir: string): string | undefined {
	const own = path.join(dir, ".env");
	if (fs.existsSync(own)) return own;
	const main = mainCheckout(dir);
	return main !== undefined && fs.existsSync(path.join(main, ".env")) ? path.join(main, ".env") : undefined;
}

if (import.meta.main) {
	const [list, dash, command, ...args] = process.argv.slice(2);
	if (list === undefined || dash !== "--" || command === undefined) {
		console.error("Usage: node scripts/with-env.ts <NAME>[,<NAME>...] -- <command> [args...]");
		process.exit(1);
	}
	const file = envFile(process.cwd());
	const fromFile = file === undefined ? {} : pick(fs.readFileSync(file, "utf8"), list.split(","));
	const child = spawn(command, args, { stdio: "inherit", env: { ...fromFile, ...process.env } });
	child.on("error", (error) => {
		console.error(`${command}: ${error.message}`);
		process.exit(1);
	});
	child.on("close", (code, signal) => process.exit(code ?? (signal === null ? 1 : 128)));
}
