import * as p from "@clack/prompts";
import { Command, CommanderError, Option } from "commander";
import { DEFAULT_APP_NAME } from "../consts.ts";
import { folderProblem } from "../helpers/scaffoldProject.ts";
import {
	type AddOnChoices,
	addOnsByLanguage,
	allAddOns,
	choicesFor,
	DEFAULT_LANGUAGE,
	defaultFor,
	findConflict,
	flagProblem,
	flagValuesOf,
	type Language,
	languages,
	NONE,
} from "../installers/index.ts";
import { nameProblem } from "../utils/appName.ts";
import { parseNameAndPath } from "../utils/parseNameAndPath.ts";

export interface CliResults {
	name: string;
	dir: string;
	git: boolean;
	install: boolean;
	json: boolean;
	language: Language;
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
	const names = ["json", "git", "install", "language", ...allAddOns.map((addOn) => addOn.name)];
	return names
		.filter((name) => process.env[`npm_config_${name}`] !== undefined)
		.map((name) => (name === "git" || name === "install" ? `--no-${name}` : `--${name}`));
}

/**
 * Why the add-on flags can't go together: in the language given, or, without --language, in every
 * language that takes them, so no answer to the language question could make them work.
 */
function flagsConflict(given: Language | undefined, addOns: Partial<AddOnChoices>): string | undefined {
	const candidates = given === undefined ? languages.map((language) => language.value) : [given];
	const problems = candidates
		.filter((language) => flagProblem(language, addOns) === undefined)
		.map((language) => findConflict(language, choicesFor(language, addOns)));
	return problems.length > 0 && problems.every((problem) => problem !== undefined) ? problems[0] : undefined;
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
		.description("Create a Roblox game, in roblox-ts or Luau, set up for coding agents")
		.argument("[dir]", `the folder to create, which also names the game (default: ${DEFAULT_APP_NAME})`)
		.option("-y, --yes", "take the defaults for everything not given, without asking", false)
		.option("--no-git", "don't make the project a git repo")
		.option("--no-install", "don't install the tools and packages (mise install, mise run install)")
		.option("--json", "print one JSON result on stdout, for agents and scripts; implies --yes", false)
		.option("--name <name>", "the game's name, when the folder's name can't be it (default: the folder's name)");
	program.addOption(
		new Option("--language <language>", `The game's language (default: ${DEFAULT_LANGUAGE})`).choices(
			languages.map((language) => language.value),
		),
	);
	// One flag per question of any language; a value the chosen language lacks is refused after parsing.
	for (const addOn of allAddOns) {
		program.addOption(
			new Option(`--${addOn.name} <${addOn.valueName}>`, addOn.question).choices(flagValuesOf(addOn.name)),
		);
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

	const flags = program.opts<{
		yes: boolean;
		git: boolean;
		install: boolean;
		json: boolean;
		name?: string;
		language?: Language;
	}>();
	const opts = program.opts<Record<string, unknown>>();
	const givenAddOns: Partial<AddOnChoices> = Object.fromEntries(
		allAddOns
			.map((addOn) => [addOn.name, opts[addOn.name]] as const)
			.filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"),
	);
	const given = program.args[0];
	const ask = !flags.yes && !flags.json && process.stdin.isTTY && process.stdout.isTTY;
	const refuse = (problem: string) => {
		if (flags.json) console.log(JSON.stringify({ ok: false, error: problem }));
		else if (ask) p.cancel(problem);
		else console.error(problem);
		process.exit(1);
	};

	let language = flags.language ?? DEFAULT_LANGUAGE;
	let input = given ?? DEFAULT_APP_NAME;
	let { git, install } = flags;
	// A flag the language has no such choice for, such as --entities components with --language luau.
	// Without --language, a flag only one language takes picks it in the prompt, so check it there.
	if (!ask || flags.language !== undefined) {
		const problem = flagProblem(language, givenAddOns);
		if (problem !== undefined) refuse(problem);
	}
	// What the command line already says can be wrong before any question: say so at once.
	if (ask && given !== undefined) {
		const problem = answerProblem(given, flags.name) ?? flagsConflict(flags.language, givenAddOns);
		if (problem !== undefined) refuse(problem);
	}
	let chosen = choicesFor(language, givenAddOns);
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
		if (flags.language === undefined) {
			const answer = await p.select({
				message: "Which language?",
				initialValue: DEFAULT_LANGUAGE as Language,
				// Leave out a language the flags given can't go with, such as Luau with --entities components.
				options: languages
					.filter((option) => flagProblem(option.value, givenAddOns) === undefined)
					.map((option) => ({ ...option })),
			});
			cancelled(answer);
			language = answer as Language;
			const problem = flagProblem(language, givenAddOns);
			if (problem !== undefined) refuse(problem);
			chosen = choicesFor(language, givenAddOns);
		}
		// Flags that can't go together, such as --ui vide with --state reflex, would leave a later
		// question with no choice to offer: refuse before asking it.
		const conflict = findConflict(language, chosen);
		if (conflict !== undefined) refuse(conflict);
		for (const addOn of addOnsByLanguage[language]) {
			if (givenAddOns[addOn.name] !== undefined) continue;
			const answer = await p.select({
				message: addOn.question,
				initialValue: defaultFor(language, addOn, chosen),
				options: [
					// Leave out what can't go with the answers so far, such as Reflex with Vide.
					...addOn.choices.filter(
						(choice) => findConflict(language, { ...chosen, [addOn.name]: choice.value }) === undefined,
					),
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
	return { name: flags.name ?? name, dir, git, install, json: flags.json, language, addOns: chosen };
}
