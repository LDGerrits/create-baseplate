import * as p from "@clack/prompts";
import pc from "picocolors";
import { logger, logToStderr, printJsonError } from "../../base/logger.ts";
import { isMultiPlace } from "../../domain/add-ons/questions.ts";
import { recordAgentFiles } from "../../domain/agent-files/agent-files.ts";
import { commitAll, initGit } from "../../domain/game/git.ts";
import { installDependencies, isMiseInstalled } from "../../domain/game/install-dependencies.ts";
import { type Rendered, renderGame } from "../../domain/game/render.ts";
import { PLACES } from "../../domain/places/place-steps.ts";
import { logNextSteps, nextSteps } from "./next-steps.ts";
import { runCli } from "./options.ts";
import { type Commit, firstCommit, type Git, type Install } from "./outcome.ts";

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
	const fail = (message: string): never => {
		if (options.json) printJsonError(message);
		else logger.error(message);
		process.exit(1);
	};

	let rendered: Rendered;
	try {
		const spec = { name: options.name, language: options.language, choices: options.addOns, version };
		rendered = renderGame(options.dir, spec, { keepToolingTests });
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
	const { replaced, stale } = rendered;
	recordAgentFiles(options.dir, version);
	const place = isMultiPlace(options.addOns) ? (PLACES[0] ?? "") : "";
	logger.success(`Created ${options.name} in ${options.dir}`);

	const git = makeRepo(options.dir, options.git);
	const install = await installGame(options.dir, options.install, options.json, stale.tools);
	const plan = firstCommit(git, install, stale);
	const commit: Commit = plan.state === "now" ? await commitGame(options.dir, plan.checked, options.json) : plan;

	const warnings = [
		...(replaced.length > 0
			? [`Replaced ${replaced.join(", ")} with the template's; git history still has the originals.`]
			: []),
		...(git.state === "skipped" ? [git.reason] : []),
		...(install.state === "failed" ? [install.error] : []),
		...(install.state === "no-mise"
			? ["mise isn't installed, so nothing was installed: https://mise.jdx.dev/getting-started.html"]
			: []),
		...(commit.state === "waiting"
			? [`Nothing is committed yet: ${commit.unlocked.join(", and ")}. Run the next steps, then commit.`]
			: []),
	];
	for (const warning of warnings) logger.warn(warning);
	const failure =
		commit.state === "failed"
			? `The first commit failed, so the game is created in ${options.dir} but nothing is committed. Its commit hook runs the game's check; fix what this reports (\`mise run check\` in the folder shows it again), then commit:\n${commit.error}`
			: undefined;
	const installed = install.state === "installed";
	const steps = {
		installed,
		packagesChanged: stale.packages,
		toolsChanged: stale.tools,
		commit: commit.state === "waiting" || commit.state === "failed",
		place,
	};
	if (options.json) {
		console.log(
			JSON.stringify({
				ok: failure === undefined,
				...(failure === undefined ? {} : { created: true, error: failure }),
				name: options.name,
				dir: options.dir,
				git: git.state === "repo",
				committed: commit.state === "committed",
				checked: commit.state === "committed" && commit.checked,
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

function makeRepo(dir: string, wanted: boolean): Git {
	if (!wanted) return { state: "off" };
	const reason = initGit(dir);
	return reason === undefined ? { state: "repo" } : { state: "skipped", reason };
}

async function installGame(dir: string, wanted: boolean, json: boolean, lock: boolean): Promise<Install> {
	if (!wanted) return { state: "off" };
	if (!isMiseInstalled()) return { state: "no-mise" };
	const spinner = json ? undefined : p.spinner();
	spinner?.start("Installing the tools and packages with mise");
	const error = await installDependencies(dir, lock, (step) => spinner?.message(step));
	spinner?.stop(error === undefined ? "Installed the tools and packages" : "Install failed");
	return error === undefined ? { state: "installed" } : { state: "failed", error };
}

async function commitGame(dir: string, checked: boolean, json: boolean): Promise<Commit> {
	const spinner = json || !checked ? undefined : p.spinner();
	spinner?.start("Making the first commit; its hook runs the game's check");
	const error = await commitAll(dir, "Initial commit from create-baseplate");
	spinner?.stop(error === undefined ? "Made the first commit; the check passed" : "The first commit failed");
	return error === undefined ? { state: "committed", checked } : { state: "failed", error };
}
