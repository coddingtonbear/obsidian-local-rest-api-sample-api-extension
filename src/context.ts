import type { App, Events } from "obsidian";

/**
 * What each `register*` function needs from the plugin. Passing this instead of the
 * plugin itself keeps those functions easy to call from a test.
 */
export interface ExtensionContext {
	app: App;
	/** This plugin's id. The host uses it as the emitter name of our events. */
	pluginId: string;
	/** This plugin's own event bus; see `events.ts`. */
	events: Events;
}
