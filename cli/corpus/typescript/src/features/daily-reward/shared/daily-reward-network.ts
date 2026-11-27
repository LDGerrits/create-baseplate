import { Networking } from "@flamework/networking";

interface ClientToServer {
	request(): void;
	claim(): void;
}

interface ServerToClient {
	changed(secondsLeft: number): void;
}

export const DailyRewardNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
