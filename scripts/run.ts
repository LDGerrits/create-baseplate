// Runs a command and collects what it printed, for the repository's scripts (the check, the CI jobs
// that create games). `echo` says what of that output also goes to this process's own: `all`, `stderr`
// only, `none`, or `inherit`, which hands the terminal to the command and so collects nothing.
import { spawn } from "node:child_process";

export interface Outcome {
	code: number | null;
	/** Standard output. */
	stdout: string;
	/** Standard output and error, as printed. */
	output: string;
}

export function run(
	command: string,
	args: string[],
	cwd: string,
	{ env = process.env, echo = "all" }: { env?: NodeJS.ProcessEnv; echo?: "all" | "stderr" | "none" | "inherit" } = {},
): Promise<Outcome> {
	return new Promise((resolve) => {
		let stdout = "";
		let output = "";
		const child = spawn(command, args, {
			cwd,
			env,
			stdio: echo === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
		});
		child.stdout?.on("data", (chunk: Buffer) => {
			if (echo === "all") process.stdout.write(chunk);
			stdout += chunk.toString();
			output += chunk.toString();
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			if (echo === "all" || echo === "stderr") process.stderr.write(chunk);
			output += chunk.toString();
		});
		child.on("error", (error) => {
			output += `${command}: ${error.message}\n`;
			if (echo !== "none") console.error(`Couldn't run ${command}: ${error.message}`);
			resolve({ code: null, stdout, output });
		});
		child.on("close", (code) => resolve({ code, stdout, output }));
	});
}
