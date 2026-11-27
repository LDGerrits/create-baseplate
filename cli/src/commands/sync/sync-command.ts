import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { choicesFor, findConflict, flagProblem, isLanguage } from "../../domain/add-ons/add-ons.ts";
import {
	type AgentFiles,
	applyPlan,
	BASE_FILE,
	CLASH_SUFFIX,
	mergeText,
	planChanges,
	planSync,
	readAgentFiles,
	readBase,
	writeBase,
} from "../../domain/agent-files/agent-files.ts";
import { pinVersion, readOrigin } from "../../domain/game/origin.ts";
import { type GameSpec, renderGame } from "../../domain/game/render.ts";

/** Whether `dir` is a game create-baseplate made, where `create-baseplate sync` applies. */
export const isGame = (dir: string) => readOrigin(dir) !== undefined;

/** The agent files this version's template writes for the game `spec` describes. */
function templateAgentFiles(spec: GameSpec, keepToolingTests: boolean): AgentFiles {
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-sync-"));
	try {
		const dir = path.join(temp, "game");
		renderGame(dir, spec, { keepToolingTests });
		return readAgentFiles(dir);
	} finally {
		fs.rmSync(temp, { recursive: true, force: true });
	}
}

/**
 * `create-baseplate sync`, run in a game: brings its agent files (AGENTS.md, skills, hooks, the
 * agent tools' settings) up to this version's template, keeping the game's own edits. With
 * `--check` it changes nothing and fails when they're out of date. Returns the exit code.
 */
export function runSync(dir: string, version: string, check: boolean, keepToolingTests: boolean): number {
	const origin = readOrigin(dir);
	if (origin?.name === undefined) {
		console.log("✗ No game here: run create-baseplate sync in a game created by create-baseplate.");
		return 1;
	}
	const { name, language } = origin;
	if (!isLanguage(language)) {
		console.log(`✗ This create-baseplate has no ${language} template: update create-baseplate first.`);
		return 1;
	}
	// A choice this version dropped would leave its add-on's agent files out, as if the game never had it.
	const dropped = flagProblem(language, origin.addOns);
	if (dropped !== undefined) {
		console.log(`✗ This create-baseplate can't sync the game's add-ons: ${dropped} Use the version the game pins.`);
		return 1;
	}
	// Questions newer than the game take their default, which is what the game has.
	const chosen = choicesFor(language, origin.addOns);
	const conflict = findConflict(language, chosen);
	if (conflict !== undefined) {
		console.log(`✗ This create-baseplate can't sync the game's add-ons together: ${conflict}`);
		return 1;
	}
	const base = readBase(dir) ?? { version: origin.version ?? "", files: {} };
	const ours = readAgentFiles(dir);
	const theirs = templateAgentFiles({ name, language, choices: chosen, version }, keepToolingTests);
	const plan = planSync(base.files, ours.files, theirs.files, mergeText, ours.clashes);
	const changed = planChanges(plan, base.files) || base.version !== version || origin.version !== version;
	const clashes = plan.conflicts.map((file) => file + CLASH_SUFFIX);

	if (check) {
		if (changed) console.log(`✗ The agent files aren't create-baseplate ${version}'s yet: run create-baseplate sync.`);
		for (const clash of clashes) console.log(`✗ ${clash} isn't merged yet: merge it by hand, then delete it.`);
		return changed || clashes.length > 0 ? 1 : 0;
	}

	applyPlan(dir, plan, theirs.executable);
	writeBase(dir, { version, files: plan.base });
	if (origin.version !== version) pinVersion(dir, version);
	const written = Object.keys(plan.write).filter((file) => !file.endsWith(CLASH_SUFFIX));
	for (const file of written) console.log(`updated ${file}`);
	for (const file of plan.remove.filter((file) => !file.endsWith(CLASH_SUFFIX))) console.log(`removed ${file}`);
	for (const clash of clashes) {
		const file = clash.slice(0, -CLASH_SUFFIX.length);
		console.log(`✗ ${file}: your edits and the template's change touch the same lines.`);
		console.log(`  The template's version is in ${clash}: merge what you want of it into ${file}, then delete it.`);
	}
	console.log(`The agent files are create-baseplate ${version}'s (recorded in ${BASE_FILE}).`);
	return clashes.length > 0 ? 1 : 0;
}
