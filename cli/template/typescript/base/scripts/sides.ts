// Roblox APIs that work on one side only, and the ESLint rules that keep them out of the wrong
// folder: the compiler can't tell, so `Players.LocalPlayer` in server/ type-checks and is nil at
// runtime, and `DataStoreService` in client/ throws or is a design error. eslint.config.ts adds
// `sideRestrictions`. The lists hold only APIs the Roblox docs say are client-only or server-only;
// an API that works on both (`HttpService:JSONEncode`, `StarterGui` as a container) isn't listed.
//
// shared/ runs on both sides, so both lists apply there. Code that guards a call with
// `RunService.IsClient()` or `IsServer()` disables the rule on that line, with a comment saying so.

/** Services that exist only on the client. */
export const CLIENT_ONLY_SERVICES = [
	"UserInputService",
	"ContextActionService",
	"GuiService",
	"HapticService",
	"VRService",
];
/** Members that only work on the client, whatever object they're read from. */
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
/** Services that exist only on the server. */
export const SERVER_ONLY_SERVICES = [
	"DataStoreService",
	"MessagingService",
	"MemoryStoreService",
	"ServerStorage",
	"ServerScriptService",
];
/** Members that only work on the server. */
export const SERVER_ONLY_MEMBERS = ["AwardBadge", "ProcessReceipt", "SetNetworkOwner", "LoadCharacter"];
/** Saving written by hand loses data (a player in two servers, a failed write); a data library's session locking prevents it. */
export const SAVE_BY_HAND =
	"Player data goes through a data library (ProfileStore or Lapis), not DataStoreService by hand. For another store, such as a leaderboard's, disable this rule on the line and say why.";
/** HttpService's requests are the server's: a client can't call them. */
export const SERVER_ONLY_HTTP = ["RequestAsync", "GetAsync", "PostAsync"];

type Side = "server" | "client" | "shared";

const WHERE: Record<Exclude<Side, "shared">, string> = {
	server: "runs only on the server",
	client: "runs only on the client",
};
const NEXT: Record<"server" | "client", string> = {
	// What runs only on the client is wrong in server/ and shared/.
	client: "move this into client/ and send the result through a remote",
	server: "move this into server/ and have the client ask for it through a remote",
};

/** One restricted API: what to match, the side it works on and the message to give. */
function messageFor(name: string, works: "server" | "client", side: Side): string {
	const base = `${name} ${WHERE[works]}`;
	if (side === "shared") {
		return `${base}, and shared/ runs on both sides: ${NEXT[works]}. If the call is guarded by RunService.IsServer()/IsClient(), disable this rule on that line with a comment saying so.`;
	}
	return `${base}: ${NEXT[works]}.`;
}

const error = (...options: unknown[]): ["error", ...unknown[]] => ["error", ...options];

/** The flat-config rules for the files of one side. */
export function sideRules(side: Side, engineSpec = false) {
	// What does not work on `side`: client-only APIs in server/, server-only in client/, both in shared/.
	const avoid: ("client" | "server")[] =
		side === "server" ? ["client"] : side === "client" ? ["server"] : ["client", "server"];
	const services = (works: "client" | "server") => (works === "client" ? CLIENT_ONLY_SERVICES : SERVER_ONLY_SERVICES);
	const members = (works: "client" | "server") => (works === "client" ? CLIENT_ONLY_MEMBERS : SERVER_ONLY_MEMBERS);

	const names = avoid.flatMap((works) =>
		services(works).map((name) => ({ name, message: messageFor(name, works, side) })),
	);
	// On the server, DataStoreService works, but player data belongs in a data library.
	// An engine spec tests real DataStores on purpose.
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
		// game:GetService("DataStoreService"), for code that doesn't import @rbxts/services.
		"no-restricted-syntax": error(
			...names.map(({ name, message }) => ({
				selector: `CallExpression[callee.property.name="GetService"][arguments.0.value="${name}"]`,
				message,
			})),
		),
	};
}

/**
 * ESLint config blocks that apply `sideRules` to each side's folders: `app/<side>/` and
 * `<layer>/<module>/<side>/`, under every source root.
 */
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
