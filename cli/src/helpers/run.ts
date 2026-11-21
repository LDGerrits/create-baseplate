import spawn from "cross-spawn";

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
