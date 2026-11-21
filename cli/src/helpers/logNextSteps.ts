import path from "node:path";
import pc from "picocolors";
import { logger } from "../utils/logger.ts";

export interface NextStepsState {
	/** The tools and packages are installed. */
	installed: boolean;
	/** The add-ons changed the packages, which the template's lockfile doesn't list yet. */
	packagesChanged: boolean;
	/** The first commit waits for the install, so the lockfile it holds matches package.json. */
	commit: boolean;
	/** In a multi-place game, the place Studio commands name. */
	place: string;
}

/** Quotes a path for a POSIX shell when it needs it, since agents run these lines as they are. */
const quoted = (text: string) => (/^[\w./@+-]+$/.test(text) ? text : `'${text.replaceAll("'", "'\\''")}'`);

export function nextSteps(dir: string, state: NextStepsState): string[] {
	const relative = path.relative(process.cwd(), dir);
	return [
		...(relative === "" ? [] : [`cd ${quoted(relative)}`]),
		...(state.installed
			? []
			: [
					"mise install",
					// A plain `pnpm install` adds the add-ons' packages to the lockfile; CI's frozen install wouldn't.
					...(state.packagesChanged ? ["mise exec -- pnpm install --no-frozen-lockfile"] : []),
					"mise run install",
				]),
		...(state.commit ? ['git add --all && git commit --message "Initial commit from create-baseplate"'] : []),
		"mise run check",
		state.place === "" ? "mise run dev" : `mise run dev ${state.place}`,
	];
}

export function logNextSteps(dir: string, state: NextStepsState) {
	logger.info(`\n${pc.bold("Next steps:")}`);
	for (const step of nextSteps(dir, state)) logger.info(`  ${pc.cyan(step)}`);
	logger.info(`\nOpen the folder with your coding agent: AGENTS.md tells it how the project works.`);
	if (!state.installed)
		logger.info(`mise installs every tool the project pins: https://mise.jdx.dev/getting-started.html`);
}
