import path from "node:path";
import pc from "picocolors";
import { logger } from "../utils/logger.ts";

export function nextSteps(dir: string, installed: boolean, withAddOns: boolean): string[] {
	const relative = path.relative(process.cwd(), dir);
	return [
		...(relative === "" ? [] : [`cd ${relative}`]),
		// Add-ons add packages the lockfile doesn't have yet, which a plain `pnpm install` adds.
		...(installed
			? []
			: [
					"mise install",
					...(withAddOns ? ["mise exec -- pnpm install --no-frozen-lockfile"] : []),
					"mise run install",
				]),
		"mise run check",
		"mise run dev",
	];
}

export function logNextSteps(dir: string, installed: boolean, withAddOns: boolean) {
	logger.info(`\n${pc.bold("Next steps:")}`);
	for (const step of nextSteps(dir, installed, withAddOns)) logger.info(`  ${pc.cyan(step)}`);
	logger.info(`\nOpen the folder with your coding agent: AGENTS.md tells it how the project works.`);
	if (!installed) logger.info(`mise installs every tool the project pins: https://mise.jdx.dev/getting-started.html`);
}
