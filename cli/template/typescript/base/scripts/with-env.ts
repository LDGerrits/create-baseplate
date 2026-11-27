import fs from "node:fs";
import path from "node:path";
import util from "node:util";
import spawn from "cross-spawn";
import { studioDefaults } from "./studio.ts";
import { mainCheckout } from "./worktree.ts";

export function pick(file: string, names: string[]): Record<string, string> {
	const picked: Record<string, string> = {};
	for (const [key, value] of Object.entries(util.parseEnv(file))) {
		const wanted = names.some((name) => (name.endsWith("*") ? key.startsWith(name.slice(0, -1)) : key === name));
		if (wanted && value !== undefined) picked[key] = value;
	}
	return picked;
}

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
	const names = list.split(",");
	const fromFile = file === undefined ? {} : pick(fs.readFileSync(file, "utf8"), names);
	const wantsStudio = names.some((name) => /^(RUR_|JEST_ROBLOX_)/.test(name));
	const defaults = wantsStudio
		? Object.fromEntries(Object.entries(studioDefaults()).filter(([key]) => key in pick(`${key}=x`, names)))
		: {};
	const child = spawn(command, args, { stdio: "inherit", env: { ...defaults, ...fromFile, ...process.env } });
	child.on("error", (error) => {
		console.error(`${command}: ${error.message}`);
		process.exit(1);
	});
	child.on("close", (code, signal) => process.exit(code ?? (signal === null ? 1 : 128)));
}
