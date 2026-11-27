import { Networking } from "@flamework/networking";

interface ClientToServer {}

interface ServerToClient {
	tick(secondsLeft: number): void;
}

export const RoundTimerNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
