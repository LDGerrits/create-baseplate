import fs from "node:fs";
import path from "node:path";
import type { AddOnChoices } from "../add-ons/questions.ts";

/**
 * What a game records in its package.json's `baseplate` field: which create-baseplate made it, in
 * which language and with which add-ons, so a later update of the template can tell what the game
 * started from.
 */
export interface Origin {
	/** The package's name, which is the game's. */
	name: string | undefined;
	version: string | undefined;
	language: string;
	addOns: Partial<AddOnChoices>;
}

const packageOf = (dir: string) => {
	const file = path.join(dir, "package.json");
	return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>) : undefined;
};

/** The game's origin, or undefined when `dir` isn't a game create-baseplate made. */
export function readOrigin(dir: string): Origin | undefined {
	const pkg = packageOf(dir);
	if (pkg === undefined || !("baseplate" in pkg)) return undefined;
	const origin = (pkg.baseplate ?? {}) as { version?: string; language?: string; addOns?: Partial<AddOnChoices> };
	return {
		name: typeof pkg.name === "string" ? pkg.name : undefined,
		version: origin.version,
		// Games made before the language question are TypeScript.
		language: origin.language ?? "typescript",
		addOns: origin.addOns ?? {},
	};
}

export function writeOrigin(dir: string, version: string, language: string, addOns: AddOnChoices) {
	const file = path.join(dir, "package.json");
	const pkg = packageOf(dir) ?? {};
	pkg.baseplate = { version, language, addOns };
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
}

/** Moves the game's pin to `version`, touching only that text, where Renovate's rule finds it. */
export function pinVersion(dir: string, version: string) {
	const file = path.join(dir, "package.json");
	const text = fs.readFileSync(file, "utf8");
	const pinned = /("baseplate":\s*\{\s*"version":\s*")[^"]*(")/;
	if (pinned.test(text)) fs.writeFileSync(file, text.replace(pinned, `$1${version}$2`));
}
