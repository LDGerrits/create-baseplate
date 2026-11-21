// Add-ons: each question offers the most popular libraries plus "none", the way create-t3-app's
// installers do. Each choice applies a folder from template/extras. None exist yet.
export interface AddOn {
	/** The flag and the question's key, such as "data". */
	readonly name: string;
	readonly question: string;
	readonly choices: readonly { value: string; label: string }[];
}

export const addOns: readonly AddOn[] = [];
