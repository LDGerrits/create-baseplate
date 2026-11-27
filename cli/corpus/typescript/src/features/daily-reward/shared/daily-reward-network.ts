import { Networking } from "@flamework/networking";

interface ClientToServer {
	/** Asks for the time left until the next claim. */
	request(): void;
	claim(): void;
}

interface ServerToClient {
	/** Seconds until the player may claim again; 0 when they may now. */
	changed(secondsLeft: number): void;
}

export const DailyRewardNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
