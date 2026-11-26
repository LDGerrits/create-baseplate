import assert from "node:assert/strict";
import test from "node:test";
import { frame, isWatchRegistration, readMessages, withWatchedFiles } from "./luau-lsp.ts";

test("splits a stream into messages, keeping a part that hasn't fully arrived", () => {
	const one = { jsonrpc: "2.0", id: 1, method: "initialize", params: { text: "é" } };
	const two = { jsonrpc: "2.0", method: "initialized", params: {} };
	const stream = Buffer.concat([frame(one), frame(two)]);
	const cut = stream.length - 5;
	const first = readMessages(stream.subarray(0, cut));
	assert.deepEqual(first.messages, [one]);
	const second = readMessages(Buffer.concat([first.rest, stream.subarray(cut)]));
	assert.deepEqual(second.messages, [two]);
	assert.equal(second.rest.length, 0);
});

test("tells luau-lsp that the client watches files", () => {
	const message = withWatchedFiles({
		jsonrpc: "2.0",
		id: 0,
		method: "initialize",
		params: { capabilities: { workspace: { didChangeWatchedFiles: { dynamicRegistration: false }, applyEdit: true } } },
	});
	const workspace = (message.params as { capabilities: { workspace: Record<string, unknown> } }).capabilities.workspace;
	assert.deepEqual(workspace.didChangeWatchedFiles, { dynamicRegistration: true });
	assert.equal(workspace.applyEdit, true, "the rest stays");
	const other = { jsonrpc: "2.0", method: "initialized", params: {} };
	assert.deepEqual(withWatchedFiles(other), other);
	assert.deepEqual(
		withWatchedFiles({ jsonrpc: "2.0", id: 0, method: "initialize", params: {} }).params,
		{ capabilities: { workspace: { didChangeWatchedFiles: { dynamicRegistration: true } } } },
		"a client that sent no capabilities",
	);
});

test("answers only a registration that is all file watching", () => {
	const register = (...methods: string[]) => ({
		jsonrpc: "2.0",
		id: 7,
		method: "client/registerCapability",
		params: { registrations: methods.map((method, id) => ({ id: String(id), method })) },
	});
	assert.equal(isWatchRegistration(register("workspace/didChangeWatchedFiles")), true);
	assert.equal(isWatchRegistration(register("workspace/didChangeWatchedFiles", "textDocument/formatting")), false);
	assert.equal(isWatchRegistration(register()), false);
	assert.equal(isWatchRegistration({ jsonrpc: "2.0", method: "window/logMessage", params: {} }), false);
});

test("skips what isn't a message rather than stalling on it", () => {
	const message = { jsonrpc: "2.0", method: "initialized", params: {} };
	const noise = Buffer.from("a warning\r\n\r\n");
	const broken = Buffer.from("Content-Length: 3\r\n\r\n{x}");
	const { messages, rest } = readMessages(Buffer.concat([noise, broken, frame(message)]));
	assert.deepEqual(messages, [message]);
	assert.equal(rest.length, 0);
});
