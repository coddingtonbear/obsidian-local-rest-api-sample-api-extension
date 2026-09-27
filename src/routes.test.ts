import { App, Events } from "obsidian";
import request from "supertest";

import { PING_PATH, registerRoutes, VAULT_STATS_PATH } from "./routes";
import { addFile, API_KEY, FakeHost, makeContext, PLUGIN_ID } from "./testing/fakeHost";

function setUp(): FakeHost {
	const app = new App();
	addFile(app, "a.md");
	addFile(app, "image.png");
	const host = new FakeHost(app);
	registerRoutes(host.api, makeContext(app, new Events()));
	return host;
}

describe("GET /sample-extension/stats/", () => {
	test("returns the vault's statistics", async () => {
		const response = await request(setUp().server)
			.get(VAULT_STATS_PATH)
			.set("Authorization", `Bearer ${API_KEY}`);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ notes: 1, attachments: 1 });
	});

	test("requires the API key", async () => {
		const response = await request(setUp().server).get(VAULT_STATS_PATH);

		expect(response.status).toBe(401);
	});
});

describe("GET /sample-extension/ping/", () => {
	test("answers without an API key", async () => {
		const response = await request(setUp().server).get(PING_PATH);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ ok: true, extension: PLUGIN_ID });
	});
});
