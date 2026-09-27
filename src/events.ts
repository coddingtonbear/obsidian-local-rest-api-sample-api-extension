/**
 * Streamable events: `addStreamableEvent`. Extension API version 5.
 *
 * Each event registered here can be followed as a Server-Sent Events stream, with this
 * plugin's id as the emitter:
 *
 *   curl -X POST -H "Authorization: Bearer $API_KEY" \
 *     http://127.0.0.1:27123/events/obsidian-local-rest-api-sample-api-extension/note-measured/
 *   # => {"id": "...", "url": "..."}
 *   curl -N "<url>"
 */
import type { LocalRestApiPublicApi } from "obsidian-local-rest-api";

import type { ExtensionContext } from "./context";
import { isNoteStats, NOTE_MEASURED_EVENT } from "./stats";

/** Fired by Obsidian on `app.workspace` when the theme or a CSS snippet changes. */
export const CSS_CHANGE_EVENT = "css-change";

export function registerEvents(
	api: LocalRestApiPublicApi,
	context: ExtensionContext,
): void {
	// An event of our own, fired on the plugin's own event bus by `measureNote`.
	api.addStreamableEvent(NOTE_MEASURED_EVENT, {
		source: context.events,
		// `serialize` receives the arguments the event was triggered with, and decides
		// everything a subscriber sees; the host adds only `emitter` and `event`.
		// Return just what somebody holding a stream URL should learn, and null to
		// send nothing for an occurrence.
		serialize: (noteStats) =>
			isNoteStats(noteStats)
				? { path: noteStats.path, words: noteStats.words }
				: null,
	});

	// An event somebody else fires: `source` can be any of Obsidian's event emitters.
	// The host listens on `source` for the name you register, so the name has to be
	// the one the event is fired under.
	api.addStreamableEvent(CSS_CHANGE_EVENT, {
		source: context.app.workspace,
		serialize: () => ({ changedAt: new Date().toISOString() }),
	});
}
