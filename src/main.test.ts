import { App, Notice, type PluginManifest } from "obsidian";

import LocalRestApiSampleExtensionPlugin from "./main";
import { FakeHost } from "./testing/fakeHost";

const MANIFEST: PluginManifest = {
	id: "obsidian-local-rest-api-sample-api-extension",
	name: "Local REST API Sample API Extension",
	version: "1.0.0",
	minAppVersion: "1.13.1",
	description: "",
	author: "",
};

const HOST_LOADED_EVENT = "obsidian-local-rest-api:loaded";

function shownNotices(): string[] {
	return (Notice as unknown as { _messages: string[] })._messages;
}

function setUp(): { app: App; host: FakeHost; plugin: LocalRestApiSampleExtensionPlugin } {
	shownNotices().length = 0;
	const app = new App();
	return {
		app,
		host: new FakeHost(app),
		plugin: new LocalRestApiSampleExtensionPlugin(app, MANIFEST),
	};
}

describe("the plugin's lifecycle", () => {
	test("registers everything when the host is already loaded", async () => {
		const { host, plugin } = setUp();
		host.install();

		await plugin.onload();

		expect(host.simpleTools).toHaveLength(1);
		expect(host.tools).toHaveLength(1);
		expect(host.resources).toHaveLength(1);
		expect(host.resourceTemplates).toHaveLength(1);
		expect(host.prompts).toHaveLength(1);
		expect(host.events.size).toBe(2);
		expect(host.openApiDescriptions).toHaveLength(1);
	});

	test("waits for the host when the host loads later", async () => {
		const { app, host, plugin } = setUp();

		await plugin.onload();
		expect(host.tools).toHaveLength(0);

		host.install();
		app.workspace.trigger(HOST_LOADED_EVENT);

		expect(host.tools).toHaveLength(1);
	});

	test("unregisters before registering again when the host reloads", async () => {
		const { app, host, plugin } = setUp();
		host.install();
		await plugin.onload();

		app.workspace.trigger(HOST_LOADED_EVENT);

		expect(host.unregisterCalls).toBe(1);
	});

	test("unregisters when it is unloaded", async () => {
		const { host, plugin } = setUp();
		host.install();
		await plugin.onload();

		plugin.onunload();
		plugin.onunload();

		expect(host.unregisterCalls).toBe(1);
	});

	test("explains itself instead of registering with a host that is too old", async () => {
		const { host, plugin } = setUp();
		host.apiVersion = 2;
		host.install();

		await plugin.onload();

		expect(host.tools).toHaveLength(0);
		expect(shownNotices()).toEqual([
			expect.stringContaining("extension API version 3; version 2 is installed"),
		]);
	});
});
