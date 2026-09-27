/**
 * MCP tools, resources, resource templates, and prompts. Everything registered here
 * appears to every MCP client connected to the host's `/mcp/` endpoint.
 */
import type { TFile } from "obsidian";
import type {
	LocalRestApiPublicApi,
	McpToolResult,
} from "obsidian-local-rest-api";
import { z } from "zod";

import type { ExtensionContext } from "./context";
import { getVaultStats, measureNote } from "./stats";

export const VAULT_STATS_TOOL = "sample_vault_stats";
export const NOTE_STATS_TOOL = "sample_note_stats";
export const VAULT_STATS_RESOURCE_URI = "sample-extension://vault-stats";
export const NOTE_STATS_RESOURCE_TEMPLATE = "sample-extension://note-stats/{+path}";
export const REVIEW_NOTE_PROMPT = "sample_review_note";

/** How many notes the resource template offers in `resources/list`. */
const LISTED_NOTES = 25;

function noteStatsUri(path: string): string {
	return `sample-extension://note-stats/${encodeURI(path)}`;
}

function getNote(context: ExtensionContext, path: string): TFile | null {
	const file = context.app.vault.getFileByPath(path);
	return file?.extension === "md" ? file : null;
}

export function registerMcp(
	api: LocalRestApiPublicApi,
	context: ExtensionContext,
): void {
	// The simple form of `addMcpTool` (extension API version 2). Whatever the callback
	// returns reaches the client as one block of text: a string as it is, anything
	// else JSON-encoded. The last argument describes the tool's behavior to the client.
	api.addMcpTool(
		VAULT_STATS_TOOL,
		"Count the notes and attachments in the vault.",
		{},
		async () => getVaultStats(context.app),
		{ readOnlyHint: true, idempotentHint: true, openWorldHint: false },
	);

	// The definition form (version 3). The callback returns the whole MCP result, which
	// lets a tool declare an `outputSchema` for its `structuredContent`, return images
	// or resource links, and report a failure the model can recover from.
	api.addMcpTool({
		name: NOTE_STATS_TOOL,
		title: "Note statistics",
		description: "Count the words, characters, headings, links, and tags in a note.",
		inputSchema: {
			path: z.string().describe("Vault-relative path of a markdown note."),
		},
		outputSchema: {
			path: z.string(),
			words: z.number(),
			characters: z.number(),
			headings: z.number(),
			links: z.number(),
			tags: z.array(z.string()),
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
		callback: async (args): Promise<McpToolResult> => {
			// The host validates arguments against `inputSchema` before calling you,
			// but they arrive typed as `unknown`; parsing them again is the type-safe
			// way to read them.
			const { path } = z.object({ path: z.string() }).parse(args);
			const file = getNote(context, path);
			if (!file) {
				// `isError` tells the model the call failed in a way it can act on.
				// Throwing instead reports that the tool itself is broken.
				return {
					isError: true,
					content: [{ type: "text", text: `No markdown note at "${path}".` }],
				};
			}
			const noteStats = await measureNote(context, file);
			return {
				content: [
					{ type: "text", text: `${file.path} has ${noteStats.words} words.` },
				],
				structuredContent: { ...noteStats },
			};
		},
	});

	// A resource at one fixed URI (version 3).
	api.addMcpResource({
		name: "sample-vault-stats",
		uri: VAULT_STATS_RESOURCE_URI,
		title: "Vault statistics",
		description: "How many notes and attachments the vault holds.",
		mimeType: "application/json",
		read: async (uri) => ({
			contents: [
				{
					uri: uri.href,
					mimeType: "application/json",
					text: JSON.stringify(getVaultStats(context.app)),
				},
			],
		}),
	});

	// A family of resources addressed by an RFC 6570 URI template (version 3).
	// `{+path}` rather than `{path}`, because a note's path contains slashes and only
	// the `+` form matches them.
	api.addMcpResourceTemplate({
		name: "sample-note-stats",
		uriTemplate: NOTE_STATS_RESOURCE_TEMPLATE,
		title: "Note statistics",
		description: "Statistics for one note.",
		mimeType: "application/json",
		// Optional. Whatever this returns appears in `resources/list`; a client can
		// read any URI matching the template whether or not it is listed.
		list: async () =>
			context.app.vault
				.getMarkdownFiles()
				.sort((a, b) => b.stat.mtime - a.stat.mtime)
				.slice(0, LISTED_NOTES)
				.map((file) => ({
					uri: noteStatsUri(file.path),
					name: file.path,
					mimeType: "application/json",
				})),
		read: async (uri, variables) => {
			const variable = variables.path;
			const path = decodeURI(Array.isArray(variable) ? variable.join("/") : variable);
			const file = getNote(context, path);
			if (!file) {
				throw new Error(`No markdown note at "${path}".`);
			}
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: "application/json",
						text: JSON.stringify(await measureNote(context, file)),
					},
				],
			};
		},
	});

	// A prompt: a message template an MCP client offers to its user (version 3).
	// MCP passes prompt arguments as strings, so every field is a string schema.
	api.addMcpPrompt({
		name: REVIEW_NOTE_PROMPT,
		title: "Review a note's length",
		description: "Ask for advice on whether a note should be split up.",
		argsSchema: {
			path: z.string().describe("Vault-relative path of a markdown note."),
			focus: z.string().optional().describe("What the review should pay attention to."),
		},
		callback: async ({ path, focus }) => {
			const file = getNote(context, path);
			if (!file) {
				throw new Error(`No markdown note at "${path}".`);
			}
			const noteStats = await measureNote(context, file);
			const request =
				`The note "${file.path}" has ${noteStats.words} words under ` +
				`${noteStats.headings} headings. Should it be split into smaller notes?`;
			return {
				description: `Review the length of ${file.path}`,
				messages: [
					{
						role: "user",
						content: {
							type: "text",
							text: focus ? `${request} Pay particular attention to: ${focus}` : request,
						},
					},
				],
			};
		},
	});
}
