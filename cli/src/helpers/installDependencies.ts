import spawn from "cross-spawn";

export const isMiseInstalled = () => spawn.sync("mise", ["--version"]).status === 0;

/**
 * Runs a command without blocking, so a spinner keeps turning. Resolves to its output when it fails.
 * cross-spawn quotes the arguments and finds `.cmd` shims on Windows, which no shell does safely.
 */
export function run(command: string, args: string[], dir: string): Promise<string | undefined> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { cwd: dir });
		let output = "";
		child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
		child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
		child.on("error", (error) => resolve(error.message));
		child.on("close", (code) => resolve(code === 0 ? undefined : output.trim()));
	});
}

/**
 * Installs the project's pinned tools and packages with mise: `mise lock` when add-ons brought tools
 * (so mise.lock records their checksums too), `mise install` (Node, pnpm, Rojo, Sloptor and the rest),
 * `pnpm install` (which adds add-ons' packages to the lockfile, even where CI=true would freeze it),
 * then `mise run install` (packages, generated files, hooks). `onStep` hears each step as it starts.
 * Returns the failing step and its output, if any.
 */
export async function installDependencies(
	dir: string,
	lock: boolean,
	onStep: (step: string) => void = () => {},
): Promise<string | undefined> {
	const steps: [string, string[]][] = [
		["Trusting the project's mise.toml", ["trust", "--quiet", "."]],
		...(lock ? ([["Locking the add-ons' tools", ["lock"]]] as [string, string[]][]) : []),
		["Installing the tools (Node, pnpm, Rojo, Sloptor, ree…)", ["install"]],
		["Installing the packages", ["exec", "--", "pnpm", "install", "--no-frozen-lockfile", "--silent"]],
		["Generating files and setting up the hooks", ["run", "install"]],
		// What the CLI wrote, formatted as the first commit's check expects.
		["Formatting", ["exec", "--", "biome", "format", "--write", "."]],
	];
	for (const [step, args] of steps) {
		onStep(step);
		const error = await run("mise", args, dir);
		if (error !== undefined) return `mise ${args.join(" ")} failed:\n${error}`;
	}
	return undefined;
}
