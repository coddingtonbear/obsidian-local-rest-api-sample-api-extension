/**
 * The "business logic" of this sample: counting things in notes.
 *
 * Nothing in this file knows about Obsidian Local REST API. Your extension's real work
 * belongs in modules like this one, and the `register*` modules next to it are only
 * thin adapters that expose it over REST, MCP, and event streams.
 */
import type { App, TFile } from "obsidian";

import type { ExtensionContext } from "./context";

/** The name of the event this plugin fires on its own event bus. */
export const NOTE_MEASURED_EVENT = "note-measured";

export interface NoteStats {
	path: string;
	words: number;
	characters: number;
	headings: number;
	links: number;
	tags: string[];
}

export interface VaultStats {
	notes: number;
	attachments: number;
}

/** The fields of {@link NoteStats} that `GET .../stats/<field>` can return. */
export const NOTE_STATS_FIELDS = [
	"path",
	"words",
	"characters",
	"headings",
	"links",
	"tags",
] as const satisfies readonly (keyof NoteStats)[];

export type NoteStatsField = (typeof NOTE_STATS_FIELDS)[number];

export function isNoteStatsField(value: string): value is NoteStatsField {
	return (NOTE_STATS_FIELDS as readonly string[]).includes(value);
}

export function isNoteStats(value: unknown): value is NoteStats {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<Record<keyof NoteStats, unknown>>;
	return (
		typeof candidate.path === "string" &&
		typeof candidate.words === "number" &&
		typeof candidate.characters === "number" &&
		typeof candidate.headings === "number" &&
		typeof candidate.links === "number" &&
		Array.isArray(candidate.tags)
	);
}

export function countWords(text: string): number {
	const words = text.trim().split(/\s+/);
	return words.length === 1 && words[0] === "" ? 0 : words.length;
}

export function getVaultStats(app: App): VaultStats {
	const notes = app.vault.getMarkdownFiles().length;
	return { notes, attachments: app.vault.getFiles().length - notes };
}

/**
 * Measures a note, and announces that it did on the plugin's event bus. That event is
 * what `events.ts` makes streamable.
 */
export async function measureNote(
	context: ExtensionContext,
	file: TFile,
): Promise<NoteStats> {
	const text = await context.app.vault.cachedRead(file);
	const cache = context.app.metadataCache.getFileCache(file);
	const stats: NoteStats = {
		path: file.path,
		words: countWords(text),
		characters: text.length,
		headings: cache?.headings?.length ?? 0,
		links: cache?.links?.length ?? 0,
		tags: [...new Set((cache?.tags ?? []).map((tag) => tag.tag))],
	};
	context.events.trigger(NOTE_MEASURED_EVENT, stats);
	return stats;
}
