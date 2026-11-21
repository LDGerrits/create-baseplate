#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runCli } from "./cli/index.ts";
import { commitAll, initGit } from "./helpers/git.ts";
import { installDependencies, isMiseInstalled } from "./helpers/installDependencies.ts";
import { logNextSteps, nextSteps } from "./helpers/logNextSteps.ts";
import { makeMultiPlace, PLACES } from "./helpers/makeMultiPlace.ts";
import { scaffoldProject } from "./helpers/scaffoldProject.ts";
import { setProjectName } from "./helpers/setProjectName.ts";
import { findConflict, installAddOns } from "./installers/index.ts";
import { nameProblem } from "./utils/appName.ts";
import { logger, logToStderr } from "./utils/logger.ts";

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

	const problem = nameProblem(options.name);
	if (problem !== undefined) fail(problem);

	const conflict = findConflict(options.addOns);
	if (conflict !== undefined) fail(conflict);

	let replaced: string[] = [];
	try {
		replaced = scaffoldProject(options.dir);
	} catch (error) {
		fail(error instanceof Error ? error.message : String(error));
	}
	setProjectName(options.dir, options.name);
	const packages = () => {
		const pkg = JSON.parse(fs.readFileSync(path.join(options.dir, "package.json"), "utf8")) as Record<string, unknown>;
		return JSON.stringify([pkg.dependencies, pkg.devDependencies]);
	};
	const basePackages = packages();
	// The [tools] of mise.toml, which the template's mise.lock covers until an add-on brings a tool.
	const tools = () =>
		/^\[tools\]\n([\s\S]*?)(?=^\[)/m.exec(fs.readFileSync(path.join(options.dir, "mise.toml"), "utf8"))?.[1];
	const baseTools = tools();
	installAddOns(options.dir, options.addOns);
	if (options.addOns.places === "multi") makeMultiPlace(options.dir, options.name);
	// The template's lockfile lists the base's packages only, until an install adds the add-ons'.
	const packagesChanged = packages() !== basePackages;
	const toolsChanged = tools() !== baseTools;
	// In a multi-place game, Studio commands name a place.
	const place = options.addOns.places === "multi" ? (PLACES[0] ?? "") : "";
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
			const error = await installDependencies(options.dir, toolsChanged, (step) => spinner?.message(step));
			spinner?.stop(error === undefined ? "Installed the tools and packages" : "Install failed");
			if (error === undefined) installed = true;
			else warnings.push(error);
		} else {
			warnings.push("mise isn't installed, so nothing was installed: https://mise.jdx.dev/getting-started.html");
		}
	}

	let committed = false;
	if (git && !installed && packagesChanged) {
		// Committed now, the lockfile wouldn't match package.json, and the game's install fails on that.
		warnings.push(
			"Nothing is committed yet: pnpm-lock.yaml doesn't list the add-ons' packages until the next steps install them. Commit after that.",
		);
	} else if (git) {
		// Once installed, this commit goes through the project's commit hook, which runs its check.
		const spinner = options.json || !installed ? undefined : p.spinner();
		spinner?.start("Making the first commit; its hook runs the game's check");
		const error = await commitAll(options.dir, "Initial commit from create-baseplate");
		spinner?.stop(error === undefined ? "Made the first commit; the check passed" : "The first commit failed");
		if (error === undefined) committed = true;
		else warnings.push(`The first commit failed:\n${error}`);
	}

	for (const warning of warnings) logger.warn(warning);
	const steps = { installed, packagesChanged, toolsChanged, commit: git && !committed && packagesChanged, place };
	if (options.json) {
		console.log(
			JSON.stringify({
				ok: true,
				name: options.name,
				dir: options.dir,
				git,
				committed,
				installed,
				addOns: options.addOns,
				warnings,
				nextSteps: nextSteps(options.dir, steps),
			}),
		);
	} else {
		logNextSteps(options.dir, steps);
		logger.info(pc.dim(`create-baseplate ${version}`));
	}
}

main().catch((error: unknown) => {
	if (json) console.log(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
	logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
	process.exit(1);
});
