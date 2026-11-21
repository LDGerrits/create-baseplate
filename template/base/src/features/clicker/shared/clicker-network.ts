import { Networking } from "@flamework/networking";

interface ClientToServer {
	click(): void;
}

interface ServerToClient {
	clicksChanged(clicks: number): void;
}

export const ClickerNetwork = Networking.createEvent<ClientToServer, ServerToClient>();
