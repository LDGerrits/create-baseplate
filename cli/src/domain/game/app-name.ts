/** A name npm accepts for a package: lowercase, no spaces, not starting with . or _. Undefined when valid. */
export function validateAppName(name: string): string | undefined {
	if (name.length === 0 || name.length > 214) return "Name it with 1 to 214 characters.";
	if (/^[._]/.test(name)) return "The name can't start with . or _.";
	if (!/^[a-z0-9][a-z0-9._~-]*$/.test(name)) return "Use lowercase letters, digits and - . _ ~ only, such as my-game.";
	return undefined;
}

/** Why `name` can't name the game, as the CLI says it, if it can't. */
export function nameProblem(name: string): string | undefined {
	const invalid = validateAppName(name);
	return invalid === undefined ? undefined : `"${name}" can't name the game: ${invalid}`;
}
