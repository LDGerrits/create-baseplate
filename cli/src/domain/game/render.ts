import fs from "node:fs";
import path from "node:path";
import { installAddOns, miseTools } from "../add-ons/apply.ts";
import { isMultiPlace } from "../add-ons/questions.ts";
import { makeMultiPlace } from "../places/multi-place.ts";
import { writeOrigin } from "./origin.ts";
import { setProjectName } from "./project-name.ts";
import { dropToolingTests, scaffoldProject } from "./scaffold.ts";
import type { GameSpec } from "./spec.ts";

export interface Rendered {
	/** Files the folder already had that the template replaced. */
	replaced: string[];
	/**
	 * Lockfiles the add-ons left behind until an install: pnpm-lock.yaml (packages), wally.lock
	 * (a Luau game's Wally packages) and mise.lock (tools). The template's lockfiles lock the base only.
	 */
	stale: { packages: boolean; wally: boolean; tools: boolean };
}

/** package.json's packages, which pnpm-lock.yaml locks. */
const packages = (dir: string) => {
	const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")) as Record<string, unknown>;
	return JSON.stringify([pkg.dependencies, pkg.devDependencies]);
};
/** A Luau game's Roblox packages, which wally.lock locks. */
const wallyPackages = (dir: string) => {
	const wally = path.join(dir, "wally.toml");
	return fs.existsSync(wally) ? fs.readFileSync(wally, "utf8") : undefined;
};
/** The [tools] of mise.toml, which the template's mise.lock covers until an add-on brings a tool. */
const tools = (dir: string) => miseTools(fs.readFileSync(path.join(dir, "mise.toml"), "utf8"));

/**
 * Makes the game `spec` describes in `dir`, which must be missing, empty or a new repo: the
 * language's template, named, with its add-ons, in several places when chosen, and its origin
 * recorded. Creating a game and syncing one's agent files both make it this way.
 */
export function renderGame(dir: string, spec: GameSpec, options: { keepToolingTests: boolean }): Rendered {
	const replaced = scaffoldProject(dir, spec.language);
	setProjectName(dir, spec.name);
	const before = { packages: packages(dir), wally: wallyPackages(dir), tools: tools(dir) };
	installAddOns(dir, spec.language, spec.choices);
	if (isMultiPlace(spec.choices)) makeMultiPlace(dir, spec.name, spec.language, spec.choices);
	if (!options.keepToolingTests) dropToolingTests(dir);
	writeOrigin(dir, spec);
	return {
		replaced,
		stale: {
			packages: packages(dir) !== before.packages,
			wally: wallyPackages(dir) !== before.wally,
			tools: tools(dir) !== before.tools,
		},
	};
}
