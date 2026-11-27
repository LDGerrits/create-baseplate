import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import {
	type Answers,
	allMatrices,
	BATCH_SIZE,
	batchesOf,
	docsOnly,
	events,
	generators,
	MIN_NODE,
	outputsOf,
	plan,
} from "../../.github/scripts/generate-matrix.ts";
import { DEFAULT_LANGUAGE, type Language } from "../src/domain/add-ons/language.ts";
import { addOnsByLanguage } from "../src/domain/add-ons/questions.ts";

for (const [language, generator] of Object.entries(generators) as [Language, (typeof generators)[Language]][]) {
	const { allowed, allPairs, flagsOf, matrices, pairsOf, questions } = generator;
	const flags = (games: Answers[]) => games.map(flagsOf);
	const prefix = language === DEFAULT_LANGUAGE ? "" : `--language ${language}`;
	const withPrefix = (rest: string) => [prefix, rest].filter((part) => part !== "").join(" ");

	test(`${language}: the full set creates a game with no add-ons, and with each choice alone`, () => {
		const created = flags(matrices.full);
		assert.equal(created[0], prefix);
		for (const addOn of addOnsByLanguage[language]) {
			for (const choice of addOn.choices) {
				if (choice.value !== addOn.defaultValue) {
					assert.ok(created.includes(withPrefix(`--${addOn.name} ${choice.value}`)), `--${addOn.name} ${choice.value}`);
				}
			}
		}
	});

	test(`${language}: the pull request's set is smaller than the full one, which adds each choice alone`, () => {
		const created = flags(matrices.pull);
		assert.equal(created[0], prefix);
		assert.ok(created.length < matrices.full.length, `${created.length} against ${matrices.full.length}`);
	});

	test(`${language}: creates a game with every question answered, once per UI`, () => {
		const onlyChoice = (q: (typeof questions)[number]) => q.values.filter((value) => value !== "none").length === 1;
		const fitsAnother = (game: Answers, q: (typeof questions)[number]) =>
			q.values.some((value) => value !== "none" && value !== q.defaultValue && allowed({ ...game, [q.name]: value }));
		const uis = questions.find((question) => question.name === "ui")?.values ?? [];
		for (const ui of uis) {
			const all = matrices.pull.find(
				(game) =>
					game.ui === ui &&
					questions.every(
						(q) =>
							q.name === "ui" ||
							(game[q.name] !== "none" && (onlyChoice(q) || game[q.name] !== q.defaultValue)) ||
							!fitsAnother(game, q),
					),
			);
			assert.ok(all, `every question with ${ui}`);
		}
	});

	test(`${language}: every two choices of different questions meet in some created game, in each set`, () => {
		for (const set of [matrices.pull, matrices.full]) {
			const covered = new Set(set.flatMap(pairsOf));
			const missing = allPairs().filter((pair) => !covered.has(pair));
			assert.deepEqual(missing, []);
		}
	});

	test(`${language}: creates no game the CLI would refuse, and stays small`, () => {
		for (const games of Object.values(matrices)) {
			for (const game of games) assert.ok(allowed(game), flagsOf(game));
		}
		assert.ok(matrices.pull.length <= 14, `${matrices.pull.length} games`);
		assert.ok(matrices.full.length <= 20, `${matrices.full.length} games`);
	});

	test(`${language}: runs each choice once in the real engine`, () => {
		const run = new Set(matrices.engine.flatMap((game) => Object.entries(game).map((entry) => entry.join("="))));
		for (const question of questions) {
			for (const value of question.values) assert.ok(run.has(`${question.name}=${value}`), `${question.name}=${value}`);
		}
	});
}

test("reads the manifests' conflicts, such as Reflex with Vide", () => {
	assert.equal(generators.typescript.allowed({ ui: "vide", state: "reflex" }), false);
});

test("CI creates games of every language", () => {
	for (const job of ["pull", "full"] as const) {
		assert.ok(allMatrices[job].includes(""));
		assert.ok(allMatrices[job].includes("--language typescript"));
	}
	assert.ok(allMatrices.windows.includes("--language typescript"));
});

const games = (batches: { games: string[] }[]) => batches.flatMap((batch) => batch.games);
const weighed = (count: number) =>
	Array.from({ length: count }, (_, i) => ({ flags: `--game ${i}`, weight: 1 + (i % 3) / 10 }));

test("batches hold every game once, at most BATCH_SIZE, balanced by weight", () => {
	for (const count of [1, 5, 6, 7, 13, 18, 33]) {
		const batches = batchesOf("typescript", weighed(count));
		assert.equal(batches.length, Math.ceil(count / BATCH_SIZE), `${count} games`);
		assert.deepEqual(
			games(batches).sort(),
			weighed(count)
				.map((game) => game.flags)
				.sort(),
		);
		for (const batch of batches) assert.ok(batch.games.length <= BATCH_SIZE);
		const sizes = batches.map((batch) => batch.games.length);
		assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${sizes}`);
	}
	const heavy = batchesOf(
		"typescript",
		[
			{ flags: "a", weight: 3 },
			{ flags: "b", weight: 3 },
			{ flags: "c", weight: 1 },
			{ flags: "d", weight: 1 },
		],
		{ size: 2 },
	);
	assert.deepEqual(
		heavy.map((batch) => batch.games),
		[
			["a", "c"],
			["b", "d"],
		],
	);
});

test("batches name themselves, and the first takes the template and counts it as a game", () => {
	assert.equal(batchesOf("luau", weighed(3))[0]?.name, "luau");
	const batches = batchesOf("luau", weighed(11), { template: true });
	assert.deepEqual(
		batches.map((batch) => batch.name),
		["luau 1/2", "luau 2/2"],
	);
	assert.deepEqual(
		batches.map((batch) => batch.template),
		[true, false],
	);
	assert.deepEqual(
		batches.map((batch) => batch.games.length),
		[5, 6],
	);
	assert.equal(
		batches.every((batch) => batch.language === "luau"),
		true,
	);
});

test("a pull request creates the pull sets, in batches of one language each, with each template checked once", () => {
	const { create, windows, engine } = plan({
		event: "pull_request",
		headRef: "feature",
		changedFiles: ["cli/src/main.ts"],
	});
	assert.deepEqual(games(create).sort(), [...allMatrices.pull].sort());
	assert.deepEqual(
		create
			.filter((batch) => batch.template)
			.map((batch) => batch.language)
			.sort(),
		["luau", "typescript"],
	);
	for (const batch of create) {
		for (const game of batch.games) {
			assert.equal(game.includes("--language typescript"), batch.language === "typescript", game);
		}
	}
	assert.deepEqual(games(windows).sort(), [...allMatrices.windows].sort());
	assert.ok(windows.every((batch) => !batch.template));
	assert.deepEqual(engine, []);
});

test("a push to main, the nightly run and a run by hand create the full sets and run the engine", () => {
	for (const event of ["push", "schedule", "workflow_dispatch"] as const) {
		const { create, windows, engine } = plan({ event, headRef: "" });
		assert.deepEqual(
			games(create.filter((batch) => batch.node === undefined)).sort(),
			[...allMatrices.full].sort(),
			event,
		);
		assert.deepEqual(games(windows).sort(), [...allMatrices.windows].sort(), event);
		assert.deepEqual(engine, allMatrices.engine, event);
	}
});

test("only the nightly run and a run by hand add the macOS games and the minimum Node", () => {
	const minimum = (
		JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { engines: { node: string } }
	).engines.node.replace(">=", "");
	assert.match(MIN_NODE, /^\d+\.\d+\.\d+$/);
	assert.ok(MIN_NODE.startsWith(minimum), "the minimum is what the CLI's engines say");
	for (const event of ["schedule", "workflow_dispatch"] as const) {
		const { create, macos } = plan({ event, headRef: "" });
		assert.deepEqual(games(macos).sort(), ["", "--language typescript"], event);
		assert.deepEqual(
			macos.map((batch) => batch.language).sort(),
			["luau", "typescript"],
			"a game of each language, checked as a game",
		);
		assert.ok(macos.every((batch) => !batch.template && batch.node === undefined));
		const old = create.filter((batch) => batch.node !== undefined);
		assert.deepEqual(old, [
			{
				name: `node ${MIN_NODE}`,
				language: "typescript",
				games: ["--language typescript"],
				template: false,
				node: MIN_NODE,
			},
		]);
		assert.deepEqual(games(create.filter((batch) => batch.node === undefined)).sort(), [...allMatrices.full].sort());
	}
	for (const event of ["push", "pull_request"] as const) {
		const { create, macos } = plan({ event, headRef: "feature", changedFiles: ["cli/src/main.ts"] });
		assert.deepEqual(macos, [], event);
		assert.ok(
			create.every((batch) => batch.node === undefined),
			event,
		);
	}
});

test("a pull request from Renovate also runs the engine", () => {
	const { create, engine } = plan({
		event: "pull_request",
		headRef: "renovate/biome-2.x",
		changedFiles: ["package.json"],
	});
	assert.deepEqual(engine, allMatrices.engine);
	assert.deepEqual(games(create).sort(), [...allMatrices.pull].sort());
});

test("a pull request that changes only the docs creates no game", () => {
	const changed = [
		"www/src/content/docs/faq.md",
		"README.md",
		"cli/CHANGELOG.md",
		"www/package.json",
		".changeset/x.md",
	];
	for (const headRef of ["docs", "renovate/astro"]) {
		assert.deepEqual(plan({ event: "pull_request", headRef, changedFiles: changed }), {
			create: [],
			windows: [],
			macos: [],
			engine: [],
		});
	}
	assert.equal(plan({ event: "pull_request", changedFiles: [...changed, "cli/src/main.ts"] }).create.length > 0, true);
	assert.equal(plan({ event: "push", changedFiles: changed }).create.length > 0, true);
});

test("only the docs site and Markdown files outside the templates are docs", () => {
	assert.equal(docsOnly(["www/src/content/docs/faq.md", "www/astro.config.ts", "AGENTS.md", "cli/README.md"]), true);
	assert.equal(
		docsOnly(["cli/template/typescript/base/AGENTS.md"]),
		false,
		"a template's Markdown ships in every game",
	);
	assert.equal(docsOnly(["cli/template/luau/extras/data/lapis/AGENTS.md", "README.md"]), false);
	assert.equal(docsOnly(["README.md", ".github/workflows/ci.yml"]), false);
	assert.equal(docsOnly(["cli/src/docs.ts"]), false);
	assert.equal(docsOnly(["README.mdx"]), false);
	assert.equal(docsOnly([]), false, "no files means unknown");
});

test("the plan's outputs say which jobs run, so a pull request of only docs still ends in CI passed", () => {
	const none = outputsOf(plan({ event: "pull_request", changedFiles: ["README.md"] }));
	assert.deepEqual(
		[none["run-create"], none["run-windows"], none["run-macos"], none["run-engine"]],
		["false", "false", "false", "false"],
	);
	assert.deepEqual(JSON.parse(none.create ?? ""), { include: [] });
	const main = outputsOf(plan({ event: "push" }));
	assert.deepEqual(
		[main["run-create"], main["run-windows"], main["run-macos"], main["run-engine"]],
		["true", "true", "false", "true"],
	);
	assert.equal(outputsOf(plan({ event: "schedule" }))["run-macos"], "true");
	const batch = (
		JSON.parse(main.create ?? "") as {
			include: { name: string; language: string; games: string[]; template: boolean }[];
		}
	).include[0];
	assert.deepEqual(Object.keys(batch ?? {}).sort(), ["games", "language", "name", "template"], "no node on a push");
	assert.deepEqual(events.length, 4);
});

test("every question answered: Darklua and partially managed, which conflict, each get a game, and Windows runs Darklua", () => {
	for (const language of ["typescript", "luau"] as const) {
		const { matrices, flagsOf } = generators[language];
		const pull = matrices.pull.map(flagsOf);
		assert.ok(
			pull.some((flags) => flags.includes("--release darklua")),
			language,
		);
		assert.ok(
			pull.some((flags) => flags.includes("--managed partial")),
			language,
		);
		assert.ok(
			matrices.windows.map(flagsOf).some((flags) => flags.includes("--release darklua")),
			language,
		);
	}
});
