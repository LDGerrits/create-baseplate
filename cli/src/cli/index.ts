import * as p from "@clack/prompts";
import { Command } from "commander";
import { DEFAULT_APP_NAME } from "../consts.ts";
import { parseNameAndPath } from "../utils/parseNameAndPath.ts";
import { validateAppName } from "../utils/validateAppName.ts";

export interface CliResults {
	name: string;
	dir: string;
	git: boolean;
	install: boolean;
	json: boolean;
}

/**
 * Reads the options from flags, and asks for what's missing when a person runs it in a terminal.
 * With --yes, --json or no terminal (an agent, CI), it asks nothing and takes the defaults.
 */
export async function runCli(version: string): Promise<CliResults | undefined> {
	const program = new Command("create-baseplate")
		.description("Create a roblox-ts game set up for coding agents")
		.argument("[dir]", `the folder to create, which also names the game (default: ${DEFAULT_APP_NAME})`)
		.option("-y, --yes", "take the defaults for everything not given, without asking", false)
		.option("--no-git", "don't make the project a git repo")
		.option("--no-install", "don't install the tools and packages (mise install, mise run install)")
		.option("--json", "print one JSON result on stdout, for agents and scripts; implies --yes", false)
		.version(version)
		.parse();

	const flags = program.opts<{ yes: boolean; git: boolean; install: boolean; json: boolean }>();
	const given = program.args[0];
	const ask = !flags.yes && !flags.json && process.stdin.isTTY && process.stdout.isTTY;

	let input = given ?? DEFAULT_APP_NAME;
	let { git, install } = flags;
	if (ask) {
		p.intro("create-baseplate");
		const answers = await p.group(
			{
				dir: () =>
					given === undefined
						? p.text({
								message: "What will your game be called?",
								placeholder: DEFAULT_APP_NAME,
								defaultValue: DEFAULT_APP_NAME,
								validate: (value) => validateAppName(parseNameAndPath(value || DEFAULT_APP_NAME).name),
							})
						: Promise.resolve(given),
				git: () =>
					flags.git ? p.confirm({ message: "Make it a git repo?", initialValue: true }) : Promise.resolve(false),
				install: () =>
					flags.install
						? p.confirm({ message: "Install the tools and packages now (with mise)?", initialValue: true })
						: Promise.resolve(false),
			},
			{
				onCancel: () => {
					p.cancel("Cancelled.");
					process.exit(1);
				},
			},
		);
		input = answers.dir;
		git = answers.git;
		install = answers.install;
	}

	const { name, dir } = parseNameAndPath(input);
	return { name, dir, git, install, json: flags.json };
}
