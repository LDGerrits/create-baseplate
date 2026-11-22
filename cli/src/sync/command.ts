import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeMultiPlace } from "../helpers/makeMultiPlace.ts";
import { scaffoldProject } from "../helpers/scaffoldProject.ts";
import { recordOrigin, setProjectName } from "../helpers/setProjectName.ts";
import { type AddOnChoices, addOns, installAddOns } from "../installers/index.ts";
import {
	applyPlan,
	BASE_FILE,
	CLASH_SUFFIX,
	type Files,
	mergeText,
	planChanges,
	planSync,
	readAgentFiles,
	readBase,
	writeBase,
} from "./agentFiles.ts";

/** Records the agent files a new game starts with, the base its later updates merge against. */
export function recordAgentFiles(dir: string, version: string) {
	writeBase(dir, { version, files: readAgentFiles(dir) });
}

/** The agent files this version's template writes for a game with this name and these add-ons. */
function templateAgentFiles(name: string, chosen: AddOnChoices, version: string): Files {
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), "baseplate-sync-"));
	try {
		const dir = path.join(temp, "game");
		scaffoldProject(dir);
		setProjectName(dir, name);
		installAddOns(dir, chosen);
		if (chosen.places === "multi") makeMultiPlace(dir, name);
		recordOrigin(dir, version, chosen);
		return readAgentFiles(dir);
	} finally {
		fs.rmSync(temp, { recursive: true, force: true });
	}
}

/** The files a clash left beside the game's, which a person hasn't merged yet. */
function unmergedClashes(dir: string): string[] {
	const found: string[] = [];
	const walk = (folder: string) => {
		for (const entry of fs.readdirSync(path.join(dir, folder), { withFileTypes: true })) {
			const relative = folder === "" ? entry.name : `${folder}/${entry.name}`;
			if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") walk(relative);
			else if (entry.isFile() && entry.name.endsWith(CLASH_SUFFIX)) found.push(relative);
		}
	};
	walk("");
	return found;
}

/**
 * `create-baseplate sync`, run in a game: brings its agent files (AGENTS.md, skills, hooks, the
 * agent tools' settings) up to this version's template, keeping the game's own edits. With
 * `--check` it changes nothing and fails when they're out of date. Returns the exit code.
 */
export function runSync(dir: string, version: string, check: boolean): number {
	const pkgFile = path.join(dir, "package.json");
	const pkg = fs.existsSync(pkgFile) ? (JSON.parse(fs.readFileSync(pkgFile, "utf8")) as Record<string, unknown>) : {};
	const origin = pkg.baseplate as { version?: string; addOns?: Partial<AddOnChoices> } | undefined;
	if (origin === undefined || typeof pkg.name !== "string") {
		console.log("✗ No game here: run create-baseplate sync in a game created by create-baseplate.");
		return 1;
	}
	// Questions newer than the game take their default, which is what the game has.
	const chosen = Object.fromEntries(
		addOns.map((addOn) => [addOn.name, origin.addOns?.[addOn.name] ?? addOn.defaultValue]),
	) as AddOnChoices;
	const base = readBase(dir) ?? { version: origin.version ?? "", files: {} };
	const plan = planSync(base.files, readAgentFiles(dir), templateAgentFiles(pkg.name, chosen, version), mergeText);
	const changed = planChanges(plan, base.files) || base.version !== version || origin.version !== version;
	const clashes = [...new Set([...plan.conflicts.map((file) => file + CLASH_SUFFIX), ...unmergedClashes(dir)])];

	if (check) {
		if (changed) console.log(`✗ The agent files aren't create-baseplate ${version}'s yet: run create-baseplate sync.`);
		for (const clash of clashes) console.log(`✗ ${clash} isn't merged yet: merge it by hand, then delete it.`);
		return changed || clashes.length > 0 ? 1 : 0;
	}

	applyPlan(dir, plan);
	writeBase(dir, { version, files: plan.base });
	pkg.baseplate = { ...origin, version };
	fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, undefined, "\t")}\n`);
	const written = Object.keys(plan.write).filter((file) => !file.endsWith(CLASH_SUFFIX));
	for (const file of written) console.log(`updated ${file}`);
	for (const file of plan.remove) console.log(`removed ${file}`);
	for (const clash of clashes) {
		const file = clash.slice(0, -CLASH_SUFFIX.length);
		console.log(`✗ ${file}: your edits and the template's change touch the same lines.`);
		console.log(`  The template's version is in ${clash}: merge what you want of it into ${file}, then delete it.`);
	}
	console.log(`The agent files are create-baseplate ${version}'s (recorded in ${BASE_FILE}).`);
	return clashes.length > 0 ? 1 : 0;
}
