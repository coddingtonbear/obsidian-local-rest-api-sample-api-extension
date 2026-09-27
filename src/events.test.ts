import { App, Events } from "obsidian";

import { CSS_CHANGE_EVENT, registerEvents } from "./events";
import { NOTE_MEASURED_EVENT, type NoteStats } from "./stats";
import { FakeHost, makeContext } from "./testing/fakeHost";

function setUp(): { host: FakeHost; app: App; events: Events } {
	const app = new App();
	const events = new Events();
	const host = new FakeHost(app);
	registerEvents(host.api, makeContext(app, events));
	return { host, app, events };
}

describe("the note-measured event", () => {
	test("is listened for on the plugin's own event bus", () => {
		const { host, events } = setUp();

		expect(host.events.get(NOTE_MEASURED_EVENT)?.source).toBe(events);
	});

	test("streams only the path and the word count", async () => {
		const { host } = setUp();
		const stats: NoteStats = {
			path: "a.md",
			words: 3,
			characters: 13,
			headings: 0,
			links: 0,
			tags: ["#private"],
		};

		const sent = await host.events.get(NOTE_MEASURED_EVENT)?.serialize(stats);

		expect(sent).toEqual({ path: "a.md", words: 3 });
	});

	test("streams nothing for a payload it does not recognize", async () => {
		const { host } = setUp();

		const sent = await host.events.get(NOTE_MEASURED_EVENT)?.serialize("nonsense");

		expect(sent).toBeNull();
	});
});

describe("the css-change event", () => {
	test("is listened for on Obsidian's workspace", async () => {
		const { host, app } = setUp();
		const definition = host.events.get(CSS_CHANGE_EVENT);

		expect(definition?.source).toBe(app.workspace);
		expect(await definition?.serialize()).toEqual({ changedAt: expect.any(String) });
	});
});
