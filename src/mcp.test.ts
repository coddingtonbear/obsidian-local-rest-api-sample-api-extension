import { App, Events } from "obsidian";
import { z } from "zod";

import {
	NOTE_STATS_TOOL,
	registerMcp,
	REVIEW_NOTE_PROMPT,
	VAULT_STATS_RESOURCE_URI,
	VAULT_STATS_TOOL,
} from "./mcp";
import { addFile, FakeHost, makeContext } from "./testing/fakeHost";

function setUp(): FakeHost {
	const app = new App();
	addFile(app, "old.md", "one", 1);
	addFile(app, "folder/new note.md", "one two three", 2);
	addFile(app, "image.png");
	const host = new FakeHost(app);
	registerMcp(host.api, makeContext(app, new Events()));
	return host;
}

describe("the sample_vault_stats tool", () => {
	test("returns the vault's statistics", async () => {
		const [tool] = setUp().simpleTools;

		expect(tool.name).toBe(VAULT_STATS_TOOL);
		expect(tool.annotations?.readOnlyHint).toBe(true);
		await expect(tool.callback({})).resolves.toEqual({ notes: 2, attachments: 1 });
	});
});

describe("the sample_note_stats tool", () => {
	test("returns structured content matching its output schema", async () => {
		const [tool] = setUp().tools;
		expect(tool.name).toBe(NOTE_STATS_TOOL);

		const result = await tool.callback({ path: "folder/new note.md" });

		expect(result.isError).toBeUndefined();
		expect(result.content).toEqual([
			{ type: "text", text: "folder/new note.md has 3 words." },
		]);
		expect(() =>
			z.object(tool.outputSchema ?? {}).strict().parse(result.structuredContent),
		).not.toThrow();
	});

	test.each(["missing.md", "image.png"])(
		"reports %s as an error the model can see",
		async (path) => {
			const [tool] = setUp().tools;

			const result = await tool.callback({ path });

			expect(result.isError).toBe(true);
			expect(result.structuredContent).toBeUndefined();
		},
	);
});

describe("the vault statistics resource", () => {
	test("is read as JSON", async () => {
		const [resource] = setUp().resources;
		expect(resource.uri).toBe(VAULT_STATS_RESOURCE_URI);

		const result = await resource.read(new URL(resource.uri));

		expect(result.contents).toEqual([
			{
				uri: VAULT_STATS_RESOURCE_URI,
				mimeType: "application/json",
				text: JSON.stringify({ notes: 2, attachments: 1 }),
			},
		]);
	});
});

describe("the note statistics resource template", () => {
	test("lists notes, most recently modified first", async () => {
		const [template] = setUp().resourceTemplates;

		const listed = await template.list?.();

		expect(listed?.map((resource) => resource.uri)).toEqual([
			"sample-extension://note-stats/folder/new%20note.md",
			"sample-extension://note-stats/old.md",
		]);
	});

	test("reads the note a listed URI names", async () => {
		const [template] = setUp().resourceTemplates;
		const uri = new URL("sample-extension://note-stats/folder/new%20note.md");

		const result = await template.read(uri, { path: "folder/new%20note.md" });

		const [contents] = result.contents;
		expect("text" in contents && JSON.parse(contents.text)).toMatchObject({
			path: "folder/new note.md",
			words: 3,
		});
	});

	test("rejects a URI that names no note", async () => {
		const [template] = setUp().resourceTemplates;
		const uri = new URL("sample-extension://note-stats/missing.md");

		await expect(template.read(uri, { path: "missing.md" })).rejects.toThrow(
			'No markdown note at "missing.md".',
		);
	});
});

describe("the sample_review_note prompt", () => {
	test("builds a message from the note's statistics", async () => {
		const [prompt] = setUp().prompts;
		expect(prompt.name).toBe(REVIEW_NOTE_PROMPT);

		const result = await prompt.callback({ path: "old.md", focus: "headings" });

		expect(result.messages).toHaveLength(1);
		expect(result.messages[0].content).toEqual({
			type: "text",
			text:
				'The note "old.md" has 1 words under 0 headings. Should it be split ' +
				"into smaller notes? Pay particular attention to: headings",
		});
	});

	test("rejects a path that names no note", async () => {
		const [prompt] = setUp().prompts;

		await expect(prompt.callback({ path: "missing.md" })).rejects.toThrow();
	});
});
