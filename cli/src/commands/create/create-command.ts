import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger, logToStderr, printJsonError } from "../../base/logger.ts";
import { findConflict, isMultiPlace } from "../../domain/add-ons/questions.ts";
import { recordAgentFiles } from "../../domain/agent-files/agent-files.ts";
import { nameProblem } from "../../domain/game/app-name.ts";
import { commitAll, initGit } from "../../domain/game/git.ts";
import { installDependencies, isMiseInstalled } from "../../domain/game/install-dependencies.ts";
import { renderGame } from "../../domain/game/render.ts";
import { folderProblem } from "../../domain/game/scaffold.ts";
import { PLACES } from "../../domain/places/multi-place.ts";
import { logNextSteps, nextSteps } from "./next-steps.ts";
import { runCli } from "./options.ts";

let json = false;

/** `create-baseplate [folder]`: asks what to create, unless the flags say, and creates the game. */
export async function runCreate(version: string, keepToolingTests: boolean) {
	try {
		await create(version, keepToolingTests);
	} catch (error) {
		if (json) printJsonError(error instanceof Error ? error.message : String(error));
		logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
		process.exit(1);
	}
}

async function create(version: string, keepToolingTests: boolean) {
	const options = await runCli(version);
	if (options === undefined) return;
	json = options.json;
	if (options.json) logToStderr();
	const fail = (message: string) => {
		if (options.json) printJsonError(message);
		else logger.error(message);
		process.exit(1);
	};

	const problem = nameProblem(options.name);
	if (problem !== undefined) fail(problem);

	const conflict = findConflict(options.language, options.addOns);
	if (conflict !== undefined) fail(conflict);

	const folder = folderProblem(options.dir);
	if (folder !== undefined) fail(folder);
	const { replaced, stale } = renderGame(
		options.dir,
		{ name: options.name, language: options.language, choices: options.addOns, version },
		{ keepToolingTests },
	);
	recordAgentFiles(options.dir, version);
	// In a multi-place game, Studio commands name a place.
	const place = isMultiPlace(options.addOns) ? (PLACES[0] ?? "") : "";
	logger.success(`Created ${options.name} in ${options.dir}`);

	const warnings: string[] = [];
	if (replaced.length > 0) {
		warnings.push(`Replaced ${replaced.join(", ")} with the template's; git history still has the originals.`);
	}
	const gitSkipped = options.git ? initGit(options.dir) : undefined;
	if (gitSkipped !== undefined) warnings.push(gitSkipped);
	const git = options.git && gitSkipped === undefined;

	let installed = false;
	if (options.install) {
		if (isMiseInstalled()) {
			const spinner = options.json ? undefined : p.spinner();
			spinner?.start("Installing the tools and packages with mise");
			const error = await installDependencies(options.dir, stale.tools, (step) => spinner?.message(step));
			spinner?.stop(error === undefined ? "Installed the tools and packages" : "Install failed");
			if (error === undefined) installed = true;
			else warnings.push(error);
		} else {
			warnings.push("mise isn't installed, so nothing was installed: https://mise.jdx.dev/getting-started.html");
		}
	}

	let committed = false;
	let commitError: string | undefined;
	// Committed now, pnpm-lock.yaml wouldn't match package.json, or mise.lock wouldn't record the
	// add-ons' tools, and the game's install (locked, frozen) fails on that; or wally.lock wouldn't
	// list the add-ons' Wally packages, and the first install would leave it changed.
	const waitForInstall = git && !installed && (stale.packages || stale.wally || stale.tools);
	if (waitForInstall) {
		const unlocked = [
			...(stale.tools ? ["mise.lock doesn't record the add-ons' tools until `mise lock`"] : []),
			...(stale.packages ? ["pnpm-lock.yaml doesn't list the add-ons' packages until `pnpm install`"] : []),
			...(stale.wally ? ["wally.lock doesn't list the add-ons' packages until `mise run install`"] : []),
		];
		warnings.push(`Nothing is committed yet: ${unlocked.join(", and ")}. Run the next steps, then commit.`);
	} else if (git) {
		// Once installed, this commit goes through the project's commit hook, which runs its check.
		const spinner = options.json || !installed ? undefined : p.spinner();
		spinner?.start("Making the first commit; its hook runs the game's check");
		const error = await commitAll(options.dir, "Initial commit from create-baseplate");
		spinner?.stop(error === undefined ? "Made the first commit; the check passed" : "The first commit failed");
		if (error === undefined) committed = true;
		else commitError = error;
	}

	for (const warning of warnings) logger.warn(warning);
	// The first commit's hook runs the game's check, so a failure means the game doesn't pass it as
	// created. The game stays, uncommitted; the exit code says the job isn't done.
	const failure =
		commitError === undefined
			? undefined
			: `The first commit failed, so the game is created in ${options.dir} but nothing is committed. Its commit hook runs the game's check; fix what this reports (\`mise run check\` in the folder shows it again), then commit:\n${commitError}`;
	const steps = {
		installed,
		packagesChanged: stale.packages,
		toolsChanged: stale.tools,
		commit: waitForInstall || failure !== undefined,
		place,
	};
	if (options.json) {
		console.log(
			JSON.stringify({
				ok: failure === undefined,
				...(failure === undefined ? {} : { created: true, error: failure }),
				name: options.name,
				dir: options.dir,
				git,
				committed,
				installed,
				language: options.language,
				addOns: options.addOns,
				warnings,
				nextSteps: nextSteps(options.dir, steps),
			}),
		);
	} else {
		if (failure !== undefined) logger.error(failure);
		logNextSteps(options.dir, steps);
		logger.info(pc.dim(`create-baseplate ${version}`));
	}
	if (failure !== undefined) process.exitCode = 1;
}
