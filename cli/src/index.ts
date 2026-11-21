#!/usr/bin/env node
import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runCli } from "./cli/index.ts";
import { commitAll, initGit, isGitInstalled } from "./helpers/git.ts";
import { installDependencies, isMiseInstalled } from "./helpers/installDependencies.ts";
import { logNextSteps, nextSteps } from "./helpers/logNextSteps.ts";
import { scaffoldProject } from "./helpers/scaffoldProject.ts";
import { setProjectName } from "./helpers/setProjectName.ts";
import { addOns, findConflict, installAddOns } from "./installers/index.ts";
import { logger, logToStderr } from "./utils/logger.ts";
import { validateAppName } from "./utils/validateAppName.ts";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

let json = false;

async function main() {
	const options = await runCli(version);
	if (options === undefined) return;
	json = options.json;
	if (options.json) logToStderr();
	const fail = (message: string) => {
		if (options.json) console.log(JSON.stringify({ ok: false, error: message }));
		else logger.error(message);
		process.exit(1);
	};

	const invalid = validateAppName(options.name);
	if (invalid !== undefined) fail(`"${options.name}" can't name the game: ${invalid}`);

	const conflict = findConflict(options.addOns);
	if (conflict !== undefined) fail(conflict);

	try {
		scaffoldProject(options.dir);
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
	setProjectName(options.dir, options.name);
	installAddOns(options.dir, options.addOns);
	const withAddOns = addOns.some((addOn) => options.addOns[addOn.name] !== addOn.defaultValue);
	logger.success(`Created ${options.name} in ${options.dir}`);

	const git = options.git && isGitInstalled() && initGit(options.dir);
	const warnings: string[] = [];

	let installed = false;
	if (options.install) {
		if (isMiseInstalled()) {
			const spinner = options.json ? undefined : p.spinner();
			spinner?.start("Installing the tools and packages with mise");
			const error = installDependencies(options.dir, options.json || spinner !== undefined);
			spinner?.stop(error === undefined ? "Installed the tools and packages" : "Install failed");
			if (error === undefined) installed = true;
			else warnings.push(error);
		} else {
			warnings.push("mise isn't installed, so nothing was installed: https://mise.jdx.dev/getting-started.html");
		}
	}

	if (git) {
		// Once installed, this commit goes through the project's commit hook, which runs its check.
		const error = commitAll(options.dir, "Initial commit from create-baseplate");
		if (error !== undefined) warnings.push(`The first commit failed:\n${error}`);
	}

	for (const warning of warnings) logger.warn(warning);
	if (options.json) {
		console.log(
			JSON.stringify({
				ok: true,
				name: options.name,
				dir: options.dir,
				git,
				installed,
				addOns: options.addOns,
				warnings,
				nextSteps: nextSteps(options.dir, installed, withAddOns),
			}),
		);
	} else {
		logNextSteps(options.dir, installed, withAddOns);
		logger.info(pc.dim(`create-baseplate ${version}`));
	}
}

main().catch((error: unknown) => {
	if (json) console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
	logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
	process.exit(1);
});
