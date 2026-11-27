import spawn from "cross-spawn";

const commands = [
	["forge", "start", "--no-open"],
	["rogen", "serve"],
];
const children = commands.map(([command = "", ...args]) => spawn(command, args, { stdio: "inherit" }));

let code = 0;
let running = children.length;
for (const child of children) {
	child.on("exit", (status) => {
		if (status !== null && status !== 0) code = status;
		for (const other of children) other.kill();
		running -= 1;
		if (running === 0) process.exit(code);
	});
}
