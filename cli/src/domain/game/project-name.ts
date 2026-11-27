import fs from "node:fs";
import path from "node:path";

const TEMPLATE_NAME = "my-game";
const NAMED_FILES = [
	"package.json",
	"default.rogen.json",
	"src/app/client/ui.storybook.ts",
	"src/app/client/Game.storybook.luau",
	"AGENTS.md",
	"README.md",
	".gitignore",
];

/** Replaces the template's name with the project's in the files that hold it. */
export function setProjectName(dir: string, name: string) {
	for (const file of NAMED_FILES) {
		const at = path.join(dir, file);
		if (!fs.existsSync(at)) continue;
		fs.writeFileSync(at, fs.readFileSync(at, "utf8").replaceAll(TEMPLATE_NAME, name));
	}
}
