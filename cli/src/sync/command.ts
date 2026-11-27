import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeMultiPlace, managedOf } from "../helpers/makeMultiPlace.ts";
import { scaffoldProject } from "../helpers/scaffoldProject.ts";
import { recordOrigin, setProjectName } from "../helpers/setProjectName.ts";
import {
	type AddOnChoices,
	choicesFor,
	findConflict,
	flagProblem,
	installAddOns,
	isLanguage,
	type Language,
} from "../installers/index.ts";
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
} from "./agentFiles.ts";

/** Records the agent files a new game starts with, the base its later updates merge against. */
export function recordAgentFiles(dir: string, version: string) {
	writeBase(dir, { version, files: readAgentFiles(dir).files });
}

/** Whether `dir` is a game create-baseplate made, where `create-baseplate sync` applies. */
export function isGame(dir: string) {
	const file = path.join(dir, "package.json");
	return fs.existsSync(file) && "baseplate" in (JSON.parse(fs.readFileSync(file, "utf8")) as object);
}

/** The agent files this version's template writes for a game with this name, language and add-ons. */
function templateAgentFiles(name: string, language: Language, chosen: AddOnChoices, version: string): AgentFiles {
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-sync-"));
	try {
		const dir = path.join(temp, "game");
		scaffoldProject(dir, language);
		setProjectName(dir, name);
		installAddOns(dir, language, chosen);
		if (chosen.places === "multi") makeMultiPlace(dir, name, language, managedOf(chosen));
		recordOrigin(dir, version, language, chosen);
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
export function runSync(dir: string, version: string, check: boolean): number {
	const pkgFile = path.join(dir, "package.json");
	const pkg = fs.existsSync(pkgFile) ? (JSON.parse(fs.readFileSync(pkgFile, "utf8")) as Record<string, unknown>) : {};
	const origin = pkg.baseplate as { version?: string; language?: string; addOns?: Partial<AddOnChoices> } | undefined;
	if (origin === undefined || typeof pkg.name !== "string") {
		console.log("✗ No game here: run create-baseplate sync in a game created by create-baseplate.");
		return 1;
	}
	// Games made before the language question are TypeScript.
	const language = origin.language ?? "typescript";
	if (!isLanguage(language)) {
		console.log(`✗ This create-baseplate has no ${language} template: update create-baseplate first.`);
		return 1;
	}
	// A choice this version dropped would leave its add-on's agent files out, as if the game never had it.
	const dropped = flagProblem(language, origin.addOns ?? {});
	if (dropped !== undefined) {
		console.log(`✗ This create-baseplate can't sync the game's add-ons: ${dropped} Use the version the game pins.`);
		return 1;
	}
	// Questions newer than the game take their default, which is what the game has.
	const chosen = choicesFor(language, origin.addOns ?? {});
	const conflict = findConflict(language, chosen);
	if (conflict !== undefined) {
		console.log(`✗ This create-baseplate can't sync the game's add-ons together: ${conflict}`);
		return 1;
	}
	const base = readBase(dir) ?? { version: origin.version ?? "", files: {} };
	const ours = readAgentFiles(dir);
	const theirs = templateAgentFiles(pkg.name, language, chosen, version);
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
	if (origin.version !== version) {
		// Only the version, where Renovate's rule finds it, so the rest of package.json keeps its layout.
		const text = fs.readFileSync(pkgFile, "utf8");
		const pinned = /("baseplate":\s*\{\s*"version":\s*")[^"]*(")/;
		fs.writeFileSync(pkgFile, pinned.test(text) ? text.replace(pinned, `$1${version}$2`) : text);
	}
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
