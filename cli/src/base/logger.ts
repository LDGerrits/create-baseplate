import pc from "picocolors";

// With --json, stdout carries only the result, so everything else goes to stderr.
let toStderr = false;
export const logToStderr = () => {
	toStderr = true;
};
const write = (text: string) => (toStderr ? process.stderr : process.stdout).write(`${text}\n`);

export const logger = {
	info: (text: string) => write(text),
	success: (text: string) => write(pc.green(text)),
	warn: (text: string) => write(pc.yellow(text)),
	error: (text: string) => process.stderr.write(`${pc.red(text)}\n`),
};

/** With --json, a failure is one JSON result on stdout, which agents and scripts read. */
export const printJsonError = (message: string) => console.log(JSON.stringify({ ok: false, error: message }));
