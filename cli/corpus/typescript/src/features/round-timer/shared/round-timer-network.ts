import { Networking } from "@flamework/networking";

// Clients send nothing: the server only broadcasts, so the feature needs no end-to-end test of requests.
interface ClientToServer {}

interface ServerToClient {
	/** Whole seconds left in the round. */
	tick(secondsLeft: number): void;
}

export const RoundTimerNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
