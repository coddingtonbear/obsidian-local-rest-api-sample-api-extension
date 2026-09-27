import { App, Events } from "obsidian";

import { countWords, getVaultStats, measureNote, NOTE_MEASURED_EVENT } from "./stats";
import { addFile, makeContext } from "./testing/fakeHost";

describe("countWords", () => {
	test.each([
		["", 0],
		["   \n", 0],
		["one", 1],
		["  one two\nthree\t four ", 4],
	])("counts %j as %d", (text, expected) => {
		expect(countWords(text)).toBe(expected);
	});
});

describe("getVaultStats", () => {
	test("counts notes and attachments separately", () => {
		const app = new App();
		addFile(app, "a.md");
		addFile(app, "folder/b.md");
		addFile(app, "image.png");

		expect(getVaultStats(app)).toEqual({ notes: 2, attachments: 1 });
	});
});

describe("measureNote", () => {
	test("measures a note and announces it on the event bus", async () => {
		const app = new App();
		const events = new Events();
		const file = addFile(app, "a.md", "# Title\n\nSome words #tag #tag");
		const cache = app.metadataCache as unknown as { _cache: Map<unknown, unknown> };
		cache._cache.set(file, {
			headings: [{ heading: "Title", level: 1 }],
			links: [],
			tags: [{ tag: "#tag" }, { tag: "#tag" }],
		});
		const announced: unknown[] = [];
		events.on(NOTE_MEASURED_EVENT, (stats: unknown) => announced.push(stats));

		const stats = await measureNote(makeContext(app, events), file);

		expect(stats).toEqual({
			path: "a.md",
			words: 6,
			characters: 29,
			headings: 1,
			links: 0,
			tags: ["#tag"],
		});
		expect(announced).toEqual([stats]);
	});

	test("counts nothing for a note Obsidian has not indexed yet", async () => {
		const app = new App();
		const file = addFile(app, "a.md", "text");

		const stats = await measureNote(makeContext(app, new Events()), file);

		expect(stats).toMatchObject({ headings: 0, links: 0, tags: [] });
	});
});
