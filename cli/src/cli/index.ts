import * as p from "@clack/prompts";
import { Command, CommanderError, Option } from "commander";
import { DEFAULT_APP_NAME } from "../consts.ts";
import { folderProblem } from "../helpers/scaffoldProject.ts";
import { type AddOnChoices, addOns, findConflict, NONE, valuesOf } from "../installers/index.ts";
import { parseNameAndPath } from "../utils/parseNameAndPath.ts";
import { nameProblem } from "../utils/validateAppName.ts";

export interface CliResults {
	name: string;
	dir: string;
	git: boolean;
	install: boolean;
	json: boolean;
	addOns: AddOnChoices;
}

/**
 * The flags `npm create` kept for itself. Before a `--`, npm reads every flag as its own option and
 * passes it on only as an npm_config_* variable, with a value flag's value turned into a second
 * folder argument (`--ui vide` arrives as `ui=true` and `vide`), so they can't be recovered. npm's
 * own `--yes` isn't listed: npm uses it too.
 */
function flagsNpmTook(): string[] {
	if (process.env.npm_command !== "init") return [];
	const names = ["json", "git", "install", ...addOns.map((addOn) => addOn.name)];
	return names
		.filter((name) => process.env[`npm_config_${name}`] !== undefined)
		.map((name) => (name === "git" || name === "install" ? `--no-${name}` : `--${name}`));
}

/** Why the game can't be made in the folder `input` names, with `name` (--name) or the folder's name. */
function answerProblem(input: string, name: string | undefined): string | undefined {
	const parsed = parseNameAndPath(input);
	return nameProblem(name ?? parsed.name) ?? folderProblem(parsed.dir);
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
		.option("--name <name>", "the game's name, when the folder's name can't be it (default: the folder's name)");
	for (const addOn of addOns) {
		program.addOption(new Option(`--${addOn.name} <${addOn.valueName}>`, addOn.question).choices(valuesOf(addOn)));
	}
	program.version(version).exitOverride();
	const taken = flagsNpmTook();
	if (taken.length > 0) {
		const message = `npm read ${taken.join(", ")} as its own option${taken.length > 1 ? "s" : ""}, so create-baseplate never got ${taken.length > 1 ? "them" : "it"}. With npm, put the flags after --: npm create baseplate@latest my-game -- --yes`;
		if (process.env.npm_config_json === "true") console.log(JSON.stringify({ ok: false, error: message }));
		else console.error(message);
		process.exit(2);
	}
	try {
		program.parse();
	} catch (error) {
		if (!(error instanceof CommanderError)) throw error;
		// Commander has printed the message. With --json, the result says it too.
		if (error.exitCode !== 0 && process.argv.includes("--json")) {
			console.log(JSON.stringify({ ok: false, error: error.message }));
		}
		process.exit(error.exitCode);
	}

	const flags = program.opts<
		{ yes: boolean; git: boolean; install: boolean; json: boolean; name?: string } & Partial<AddOnChoices>
	>();
	const chosen = Object.fromEntries(
		addOns.map((addOn) => [addOn.name, flags[addOn.name] ?? addOn.defaultValue]),
	) as AddOnChoices;
	const given = program.args[0];
	const ask = !flags.yes && !flags.json && process.stdin.isTTY && process.stdout.isTTY;

	let input = given ?? DEFAULT_APP_NAME;
	let { git, install } = flags;
	// What the command line already says can be wrong before any question: say so at once.
	if (ask && given !== undefined) {
		const problem = answerProblem(given, flags.name) ?? findConflict(chosen);
		if (problem !== undefined) {
			p.cancel(problem);
			process.exit(1);
		}
	}
	if (ask) {
		p.intro("create-baseplate");
		const dir =
			given ??
			(await p.text({
				message: "What will your game be called?",
				placeholder: DEFAULT_APP_NAME,
				defaultValue: DEFAULT_APP_NAME,
				validate: (value) => answerProblem(value || DEFAULT_APP_NAME, flags.name),
			}));
		const cancelled = (value: unknown) => {
			if (!p.isCancel(value)) return;
			p.cancel("Cancelled.");
			process.exit(1);
		};
		cancelled(dir);
		for (const addOn of addOns) {
			if (flags[addOn.name] !== undefined) continue;
			const answer = await p.select({
				message: addOn.question,
				initialValue: addOn.defaultValue,
				options: [
					// Leave out what can't go with the answers so far, such as Reflex with Vide.
					...addOn.choices.filter((choice) => findConflict({ ...chosen, [addOn.name]: choice.value }) === undefined),
					...(addOn.allowNone ? [{ value: NONE, label: "None", hint: "add one later yourself" }] : []),
				],
			});
			cancelled(answer);
			chosen[addOn.name] = answer as string;
		}
		const answers = await p.group(
			{
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
		input = dir as string;
		git = answers.git;
		install = answers.install;
	}

	const { name, dir } = parseNameAndPath(input);
	return { name: flags.name ?? name, dir, git, install, json: flags.json, addOns: chosen };
}
