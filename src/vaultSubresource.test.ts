import { App, Events } from "obsidian";
import request from "supertest";

import { NOTE_MEASURED_EVENT } from "./stats";
import { addFile, API_KEY, FakeHost, makeContext } from "./testing/fakeHost";
import { registerVaultSubresource } from "./vaultSubresource";

function setUp(): { host: FakeHost; events: Events } {
	const app = new App();
	addFile(app, "folder/my note.md", "one two three");
	addFile(app, "image.png");
	const host = new FakeHost(app);
	const events = new Events();
	registerVaultSubresource(host.api, makeContext(app, events));
	return { host, events };
}

function get(host: FakeHost, path: string): request.Test {
	return request(host.server).get(path).set("Authorization", `Bearer ${API_KEY}`);
}

describe("the stats sub-resource", () => {
	test("returns the statistics of the note it is under", async () => {
		const { host } = setUp();

		const response = await get(host, "/vault/folder/my%20note.md/stats/");

		expect(response.status).toBe(200);
		expect(response.body).toMatchObject({ path: "folder/my note.md", words: 3 });
	});

	test("returns a single field", async () => {
		const { host } = setUp();

		const response = await get(host, "/vault/folder/my%20note.md/stats/words");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({ words: 3 });
	});

	test("answers 404 for a field that does not exist", async () => {
		const { host } = setUp();

		const response = await get(host, "/vault/folder/my%20note.md/stats/pages");

		expect(response.status).toBe(404);
		expect(response.body.message).toContain('"pages"');
	});

	test("answers 400 for a file that is not a note", async () => {
		const { host } = setUp();

		const response = await get(host, "/vault/image.png/stats/");

		expect(response.status).toBe(400);
	});

	test("announces each measurement on the event bus", async () => {
		const { host, events } = setUp();
		const announced: unknown[] = [];
		events.on(NOTE_MEASURED_EVENT, (stats: unknown) => announced.push(stats));

		await get(host, "/vault/folder/my%20note.md/stats/");

		expect(announced).toHaveLength(1);
	});
});
