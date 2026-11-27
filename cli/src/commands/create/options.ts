import * as p from "@clack/prompts";
import { Command, CommanderError, Option } from "commander";
import { printJsonError } from "../../base/logger.ts";
import { DEFAULT_LANGUAGE, type Language, languages } from "../../domain/add-ons/language.ts";
import {
	type AddOn,
	type AddOnChoices,
	addOnsByLanguage,
	allAddOns,
	choicesFor,
	defaultFor,
	findConflict,
	flagProblem,
	flagValuesOf,
	NONE,
	settleChoices,
} from "../../domain/add-ons/questions.ts";
import { nameProblem } from "../../domain/game/app-name.ts";
import { folderProblem } from "../../domain/game/scaffold.ts";
import { parseNameAndPath } from "./parse-name-and-path.ts";

/** The folder, and so the name, of a game when none is given. */
const DEFAULT_APP_NAME = "my-game";

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

/** What the recommended stack holds, such as "React and Reflex; no player data, entities, … yet". */
export function stackSummary(stack: readonly AddOn[], chosen: AddOnChoices): string {
	const picked = stack.flatMap((addOn) => addOn.choices.filter((choice) => choice.value === chosen[addOn.name]));
	const left = stack.filter((addOn) => chosen[addOn.name] === NONE).map((addOn) => addOn.topic);
	const list = (items: string[]) =>
		items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
	const has = picked.map((choice) => choice.label);
	const hasText = has.length < 2 ? has.join("") : `${has.slice(0, -1).join(", ")} and ${has.at(-1)}`;
	return [hasText, left.length > 0 ? `no ${list(left)} yet` : ""].filter((part) => part !== "").join("; ");
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
		if (process.env.npm_config_json === "true") printJsonError(message);
		else console.error(message);
		process.exit(2);
	}
	try {
		program.parse();
	} catch (error) {
		if (!(error instanceof CommanderError)) throw error;
		// Commander has printed the message. With --json, the result says it too.
		if (error.exitCode !== 0 && process.argv.includes("--json")) {
			printJsonError(error.message);
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
	const refuse = (problem: string): never => {
		if (flags.json) printJsonError(problem);
		else if (ask) p.cancel(problem);
		else console.error(problem);
		process.exit(1);
	};

	let language = flags.language ?? DEFAULT_LANGUAGE;
	let input = given ?? DEFAULT_APP_NAME;
	let { git, install } = flags;
	// The flags' choices for a language, each missing one its default; refused when they don't fit it,
	// such as --entities components with --language luau, or can't go together, such as --ui vide
	// with --state reflex (which would leave a later question with no choice to offer).
	const settle = (language: Language) => {
		const settled = settleChoices(language, givenAddOns);
		return "problem" in settled ? refuse(settled.problem) : settled.choices;
	};
	// Without --language, a flag only one language takes picks it in the prompt, so check it there.
	if (ask && flags.language !== undefined) {
		const problem = flagProblem(language, givenAddOns);
		if (problem !== undefined) refuse(problem);
	}
	// What the command line already says can be wrong before any question: say so at once.
	if (ask && given !== undefined) {
		const problem = answerProblem(given, flags.name) ?? flagsConflict(flags.language, givenAddOns);
		if (problem !== undefined) refuse(problem);
	}
	let chosen: AddOnChoices;
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
		}
		// Asking, the language may not be known until its question is answered.
		const picked = settle(language);
		const choose = async (addOn: AddOn) => {
			const answer = await p.select({
				message: addOn.question,
				initialValue: defaultFor(language, addOn, picked),
				options: [
					// Leave out what can't go with the answers so far, such as Reflex with Vide.
					...addOn.choices.filter(
						(choice) => findConflict(language, { ...picked, [addOn.name]: choice.value }) === undefined,
					),
					...(addOn.allowNone ? [{ value: NONE, label: "None", hint: "add one later yourself" }] : []),
				],
			});
			cancelled(answer);
			picked[addOn.name] = answer as string;
		};
		const unanswered = addOnsByLanguage[language].filter((addOn) => givenAddOns[addOn.name] === undefined);
		// The project's shape first, then the libraries and tools: the recommended ones, or each in turn.
		for (const addOn of unanswered.filter((addOn) => addOn.shape === true)) await choose(addOn);
		const stack = unanswered.filter((addOn) => addOn.shape !== true);
		if (stack.length > 0) {
			for (const addOn of stack) picked[addOn.name] = defaultFor(language, addOn, picked);
			const answer = await p.select({
				message: "Which libraries and tools?",
				options: [
					{ value: "recommended", label: "The recommended ones", hint: stackSummary(stack, picked) },
					{ value: "choose", label: "Choose each one" },
				],
			});
			cancelled(answer);
			if (answer === "choose") for (const addOn of stack) await choose(addOn);
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
		chosen = picked;
		input = dir as string;
		git = answers.git;
		install = answers.install;
	} else chosen = settle(language);

	const parsed = parseNameAndPath(input);
	const name = flags.name ?? parsed.name;
	const problem = nameProblem(name);
	if (problem !== undefined) refuse(problem);
	return { name, dir: parsed.dir, git, install, json: flags.json, language, addOns: chosen };
}
