export interface TestArgs {
	project?: string;
	testPathPattern?: string;
	testNamePattern?: string;
}

export function parseTestArgs(args: string[]): TestArgs {
	const result: TestArgs = {};
	const paths: string[] = [];
	for (let index = 0; index < args.length; index++) {
		const arg = args[index] ?? "";
		const [flag = "", inline] = arg.startsWith("--") ? arg.split(/=(.*)/s) : [arg];
		if (flag === "-t" || flag === "--testNamePattern" || flag === "--testPathPattern") {
			const value = inline ?? args[++index];
			if (value === undefined) throw new Error(`${flag} needs a value`);
			if (flag === "--testPathPattern") paths.push(value);
			else result.testNamePattern = value;
		} else if (arg.startsWith("-")) {
			throw new Error(`Unknown option ${flag}: use a path pattern, -t <name pattern> or --testPathPattern`);
		} else if (arg.endsWith(".project.json")) {
			result.project = arg;
		} else {
			paths.push(arg);
		}
	}
	if (paths.length > 0) result.testPathPattern = paths.join("|");
	return result;
}

export function e2eSelected(file: string, filter: TestArgs): boolean {
	if (filter.testNamePattern !== undefined) return false;
	return filter.testPathPattern === undefined || new RegExp(filter.testPathPattern).test(file);
}
