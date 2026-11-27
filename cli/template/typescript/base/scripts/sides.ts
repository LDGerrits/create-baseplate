// Roblox APIs that work on one side only, and the ESLint rules that keep them out of the wrong
// folder: the compiler can't tell, so `Players.LocalPlayer` in server/ type-checks and is nil at
// runtime, and `DataStoreService` in client/ throws or is a design error. eslint.config.ts adds
// `sideRestrictions`. The lists hold only APIs the Roblox docs say are client-only or server-only;
// an API that works on both (`HttpService:JSONEncode`, `StarterGui` as a container) isn't listed.

export const CLIENT_ONLY_SERVICES = [
	"UserInputService",
	"ContextActionService",
	"GuiService",
	"HapticService",
	"VRService",
];
export const CLIENT_ONLY_MEMBERS = [
	"LocalPlayer",
	"RenderStepped",
	"BindToRenderStep",
	"UnbindFromRenderStep",
	"CurrentCamera",
	"SetCore",
	"SetCoreGuiEnabled",
	"PlayLocalSound",
];
export const SERVER_ONLY_SERVICES = [
	"DataStoreService",
	"MessagingService",
	"MemoryStoreService",
	"ServerStorage",
	"ServerScriptService",
];
export const SERVER_ONLY_MEMBERS = ["AwardBadge", "ProcessReceipt", "SetNetworkOwner", "LoadCharacter"];
export const SAVE_BY_HAND =
	"Player data goes through a data library (ProfileStore or Lapis), not DataStoreService by hand. For another store, such as a leaderboard's, disable this rule on the line and say why.";
export const SERVER_ONLY_HTTP = ["RequestAsync", "GetAsync", "PostAsync"];

type Side = "server" | "client" | "shared";

const WHERE: Record<Exclude<Side, "shared">, string> = {
	server: "runs only on the server",
	client: "runs only on the client",
};
const NEXT: Record<"server" | "client", string> = {
	client: "move this into client/ and send the result through a remote",
	server: "move this into server/ and have the client ask for it through a remote",
};

function messageFor(name: string, works: "server" | "client", side: Side): string {
	const base = `${name} ${WHERE[works]}`;
	if (side === "shared") {
		return `${base}, and shared/ runs on both sides: ${NEXT[works]}. If the call is guarded by RunService.IsServer()/IsClient(), disable this rule on that line with a comment saying so.`;
	}
	return `${base}: ${NEXT[works]}.`;
}

const error = (...options: unknown[]): ["error", ...unknown[]] => ["error", ...options];

export function sideRules(side: Side, engineSpec = false) {
	const avoid: ("client" | "server")[] =
		side === "server" ? ["client"] : side === "client" ? ["server"] : ["client", "server"];
	const services = (works: "client" | "server") => (works === "client" ? CLIENT_ONLY_SERVICES : SERVER_ONLY_SERVICES);
	const members = (works: "client" | "server") => (works === "client" ? CLIENT_ONLY_MEMBERS : SERVER_ONLY_MEMBERS);

	const names = avoid.flatMap((works) =>
		services(works).map((name) => ({ name, message: messageFor(name, works, side) })),
	);
	if (side === "server" && !engineSpec) names.push({ name: "DataStoreService", message: SAVE_BY_HAND });
	return {
		"@typescript-eslint/no-restricted-imports": error({
			paths: names.map(({ name, message }) => ({
				name: "@rbxts/services",
				importNames: [name],
				allowTypeImports: true,
				message,
			})),
		}),
		"no-restricted-properties": error(
			...avoid.flatMap((works) => [
				...members(works).map((property) => ({ property, message: messageFor(property, works, side) })),
				...(works === "server"
					? SERVER_ONLY_HTTP.map((property) => ({
							object: "HttpService",
							property,
							message: messageFor(`HttpService.${property}`, works, side),
						}))
					: []),
			]),
		),
		"no-restricted-syntax": error(
			...names.map(({ name, message }) => ({
				selector: `CallExpression[callee.property.name="GetService"][arguments.0.value="${name}"]`,
				message,
			})),
		),
	};
}

export function sideRestrictions(roots: string[]) {
	const sides = (["server", "client", "shared"] as const).map((side) => ({
		files: roots.flatMap((root) => [
			`${root}/app/${side}/**/*.{ts,tsx}`,
			`${root}/{features,game,platform}/*/${side}/**/*.{ts,tsx}`,
		]),
		rules: sideRules(side),
	}));
	// Engine specs in server folders, which come after and so win.
	const engineSpecs = {
		files: roots.flatMap((root) => [
			`${root}/app/server/**/*.engine.spec.ts`,
			`${root}/{features,game,platform}/*/server/**/*.engine.spec.ts`,
		]),
		rules: sideRules("server", true),
	};
	return [...sides, engineSpecs];
}
