// create-baseplate as a person runs it: its own questions, options, hints and spinner messages
// (cli/src/cli/index.ts, cli/src/installers/index.ts, cli/src/index.ts and
// cli/src/helpers/installDependencies.ts), answered with the defaults and the recommended libraries
// and tools, up to the install.

const root = document.documentElement;
const term = document.getElementById("term") as HTMLElement;
const command = document.getElementById("term-cmd") as HTMLElement;
const commandTyped = command.querySelector("[data-cmdty]") as HTMLElement;
const control = document.getElementById("term-ctl") as HTMLButtonElement;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const COMMAND = "pnpm create baseplate";
interface Option {
	readonly label: string;
	readonly hint?: string;
}
const LANGUAGES: readonly Option[] = [
	{ label: "TypeScript", hint: "roblox-ts, with Flamework" },
	{ label: "Luau", hint: "Rojo, Wally, StyLua, Selene and luau-lsp" },
];
const STACK = {
	luau: "React and Charm; no player data, entities, asset uploads or release builds yet",
	ts: "React and Reflex; no player data, entities, asset uploads or release builds yet",
};
const INSTALL_STEPS: readonly (readonly [string, number])[] = [
	["Trusting the project's mise.toml", 700],
	["Installing the tools (Node, pnpm, Rojo, Sloptor, ree…)", 2600],
	["Installing the packages", 1700],
	["Generating files and setting up the hooks", 1500],
	["Formatting", 700],
];
const FRAMES = ["◒", "◐", "◓", "◑"];
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const language = () => (root.dataset.lang === "ts" ? "ts" : "luau");

let run = 0;
let visible = false;
let paused = reduce;

class Stopped extends Error {}
// Waits, unless a newer run started meanwhile.
const sleep = (ms: number, id: number) =>
	new Promise<void>((resolve, reject) => setTimeout(() => (id === run ? resolve() : reject(new Stopped())), ms));
const between = (low: number, high: number) => low + Math.random() * (high - low);

const row = (classes: string, symbol: string, html: string) => {
	const el = document.createElement("div");
	el.className = `cl ${classes}`;
	el.innerHTML = `<span class="s">${symbol}</span><span class="tx">${html}</span>`;
	term.append(el);
	return el;
};
const setText = (el: HTMLElement, html: string) => {
	(el.querySelector(".tx") as HTMLElement).innerHTML = html;
};
const answered = (question: HTMLElement) => {
	question.className = "cl q gap";
	(question.querySelector(".s") as HTMLElement).textContent = "◇";
};
const optionsHtml = (options: readonly Option[], at: number) =>
	options.map((option, i) =>
		i === at
			? `<span class="opt-on">● ${escapeHtml(option.label)}</span>${option.hint ? ` <span class="hint">(${escapeHtml(option.hint)})</span>` : ""}`
			: `<span class="hint">○ ${escapeHtml(option.label)}</span>`,
	);

// A select: the question, its options, arrow-key steps to the choice, Enter, then the answer alone.
async function select(id: number, question: string, options: readonly Option[], path: readonly number[]) {
	const q = row("q active gap", "◆", escapeHtml(question));
	const rows = options.map(() => row("a", "│", ""));
	let at = 0;
	const paint = () => {
		optionsHtml(options, at).forEach((html, i) => {
			const r = rows[i];
			if (r) setText(r, html);
		});
	};
	paint();
	await sleep(between(650, 1000), id);
	for (const to of path) {
		at = to;
		paint();
		await sleep(between(260, 420), id);
	}
	await sleep(between(180, 320), id);
	for (const r of rows) r.remove();
	answered(q);
	row("a", "│", escapeHtml(options[at]?.label ?? ""));
}

async function confirm(id: number, question: string) {
	const q = row("q active gap", "◆", escapeHtml(question));
	const a = row("a", "│", '<span class="opt-on">● Yes</span> <span class="hint">/ ○ No</span>');
	await sleep(between(600, 900), id);
	a.remove();
	answered(q);
	row("a", "│", "Yes");
}

async function play() {
	run += 1;
	const id = run;
	term.classList.remove("fade");
	term.innerHTML = "";
	commandTyped.textContent = "";
	command.classList.add("typing");
	try {
		await sleep(500, id);
		for (const char of COMMAND) {
			commandTyped.textContent += char;
			await sleep(char === " " ? between(90, 160) : between(40, 140), id);
		}
		await sleep(between(380, 560), id);
		command.classList.remove("typing");
		await sleep(260, id);
		row("", "┌", "create-baseplate");
		await sleep(220, id);

		const q = row("q active gap", "◆", "What will your game be called?");
		const a = row("a", "│", '<span class="ph">my-game</span><span class="tc"></span>');
		await sleep(between(800, 1100), id);
		let name = "";
		for (const char of "my-game") {
			name += char;
			setText(a, `${escapeHtml(name)}<span class="tc"></span>`);
			await sleep(between(60, 150), id);
		}
		await sleep(between(350, 520), id);
		answered(q);
		setText(a, name);

		const lang = language();
		await select(id, "Which language?", LANGUAGES, lang === "luau" ? [1] : []);
		await select(
			id,
			"One place, or several?",
			[
				{ label: "One place", hint: "the whole game in one place" },
				{ label: "Several places", hint: "a lobby and a game sharing code, each in projects/" },
			],
			[],
		);
		await select(
			id,
			"Should Rojo manage the whole place, or only the code?",
			[
				{ label: "The whole place", hint: "code and world are files, built and published from git" },
				{ label: "Only the code", hint: "Studio keeps the place and its world; files hold the code" },
			],
			[],
		);
		await select(
			id,
			"Which libraries and tools?",
			[{ label: "The recommended ones", hint: STACK[lang] }, { label: "Choose each one" }],
			[1, 0],
		);
		await confirm(id, "Make it a git repo?");
		await confirm(id, "Install the tools and packages now (with mise)?");

		await sleep(200, id);
		let text = "Installing the tools and packages with mise";
		const spinner = row("spin gap", FRAMES[0] ?? "", text);
		let frame = 0;
		let dots = 0;
		const turn = setInterval(() => {
			if (id !== run) {
				clearInterval(turn);
				return;
			}
			frame = (frame + 1) % FRAMES.length;
			dots = (dots + 0.125) % 4;
			(spinner.querySelector(".s") as HTMLElement).textContent = FRAMES[frame] ?? "";
			setText(spinner, `${escapeHtml(text)}${".".repeat(Math.floor(dots))}`);
		}, 80);
		await sleep(900, id);
		for (const [step, ms] of INSTALL_STEPS) {
			text = step;
			await sleep(ms * between(0.85, 1.15), id);
		}
		clearInterval(turn);
		spinner.className = "cl done gap";
		(spinner.querySelector(".s") as HTMLElement).textContent = "◇";
		setText(spinner, "Installed the tools and packages");

		await sleep(5200, id);
		term.classList.add("fade");
		await sleep(500, id);
		if (visible && !paused) void play();
	} catch (error) {
		if (!(error instanceof Stopped)) throw error;
	}
}

// The finished run, drawn at once: for the reserved height and for reduced motion.
function finalState() {
	run += 1;
	const lang = language();
	command.classList.remove("typing");
	commandTyped.textContent = COMMAND;
	term.classList.remove("fade");
	term.innerHTML = "";
	row("", "┌", "create-baseplate");
	const answers: readonly (readonly [string, string])[] = [
		["What will your game be called?", "my-game"],
		["Which language?", lang === "luau" ? "Luau" : "TypeScript"],
		["One place, or several?", "One place"],
		["Should Rojo manage the whole place, or only the code?", "The whole place"],
		["Which libraries and tools?", "The recommended ones"],
		["Make it a git repo?", "Yes"],
		["Install the tools and packages now (with mise)?", "Yes"],
	];
	for (const [question, answer] of answers) {
		row("q gap", "◇", escapeHtml(question));
		row("a", "│", escapeHtml(answer));
	}
	row("done gap", "◇", "Installed the tools and packages");
}

// Reserves the finished run's height, plus the one line an open select adds, from the first frame.
const measure = () => {
	term.style.height = "";
	finalState();
	const line = Number.parseFloat(getComputedStyle(term).lineHeight);
	term.style.height = `${term.offsetHeight + Math.ceil(line)}px`;
};
const setControl = () => {
	control.dataset.state = paused ? "paused" : "playing";
	(control.querySelector("span") as HTMLElement).textContent = paused ? "Play" : "Pause";
};

measure();
setControl();
if (reduce) control.hidden = true;
else {
	term.innerHTML = "";
	commandTyped.textContent = "";
}
new IntersectionObserver(
	(entries) => {
		for (const entry of entries) {
			const was = visible;
			visible = entry.isIntersecting;
			if (visible && !was && !paused) void play();
			if (!visible && was && !paused) finalState();
		}
	},
	{ threshold: 0.2 },
).observe(term);
control.addEventListener("click", () => {
	paused = !paused;
	setControl();
	if (paused) finalState();
	else void play();
});
let width = innerWidth;
addEventListener("resize", () => {
	if (innerWidth === width) return;
	width = innerWidth;
	measure();
	if (visible && !paused) void play();
});
new MutationObserver(() => {
	measure();
	if (visible && !paused) void play();
}).observe(root, { attributes: true, attributeFilter: ["data-lang"] });

// A module, so its names stay its own.
export {};
