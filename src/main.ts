import { Events, Notice, Plugin } from "obsidian";
import {
	ApiVersionUnsupportedError,
	getAPI,
	LOCAL_REST_API_PLUGIN_ID,
	type LocalRestApiPublicApi,
} from "obsidian-local-rest-api";

import type { ExtensionContext } from "./context";
import { registerEvents } from "./events";
import { registerMcp } from "./mcp";
import { registerOpenApiDescription } from "./openapi";
import { registerRoutes } from "./routes";
import { registerVaultSubresource } from "./vaultSubresource";

/**
 * The extension API version this plugin needs. Version 3 introduced vault
 * sub-resources, the richer MCP registrations, streamable events, and OpenAPI
 * descriptions. An extension that only adds routes and simple MCP tools can ask for 2
 * and run on older hosts.
 */
export const REQUIRED_API_VERSION = 3;

const HOST_LOADED_EVENT = "obsidian-local-rest-api:loaded";

export default class LocalRestApiSampleExtensionPlugin extends Plugin {
	private api: LocalRestApiPublicApi | undefined;
	/** This plugin's own event bus, the source of the events `events.ts` streams. */
	private events = new Events();

	/**
	 * Everything this extension adds to Obsidian Local REST API. Each function covers
	 * one part of the extension API, in a file of its own; start reading there.
	 */
	private registerExtension(): void {
		// 1. Get a handle. It is tied to this plugin's manifest, and everything
		//    registered through it is removed together by `unregister()`.
		const api = this.getApiHandle();
		if (!api) return;
		this.api = api;

		const context: ExtensionContext = {
			app: this.app,
			pluginId: this.manifest.id,
			events: this.events,
		};

		// 2. Register whatever your extension offers.
		registerRoutes(api, context); //            addRoute, addPublicRoute
		registerVaultSubresource(api, context); //  addVaultSubresource
		registerMcp(api, context); //               addMcpTool, addMcpResource,
		//                                          addMcpResourceTemplate, addMcpPrompt
		registerEvents(api, context); //            addStreamableEvent
		registerOpenApiDescription(api); //         addOpenApiDescription
	}

	private getApiHandle(): LocalRestApiPublicApi | undefined {
		// The host hands back the same handle for the same plugin id until that handle
		// is unregistered, so start from a clean slate; registering a route or an MCP
		// tool a second time would otherwise duplicate it or throw.
		this.api?.unregister();
		this.api = undefined;

		try {
			// Undefined when the host is not installed, not enabled, or not loaded yet.
			return getAPI(this.app, this.manifest, REQUIRED_API_VERSION);
		} catch (error) {
			if (error instanceof ApiVersionUnsupportedError) {
				new Notice(
					`${this.manifest.name} needs a newer version of Local REST API ` +
						`(extension API version ${error.requestedVersion}; ` +
						`version ${error.availableVersion} is installed).`,
				);
				return undefined;
			}
			throw error;
		}
	}

	//
	// Everything below this point can be left as it is: it registers the extension
	// when both plugins are ready, whichever of the two loads first, and removes it
	// again when this plugin is disabled.
	//

	async onload(): Promise<void> {
		// If the host is already running, register now.
		if (this.app.plugins.enabledPlugins.has(LOCAL_REST_API_PLUGIN_ID)) {
			this.registerExtension();
		}

		// The host fires this each time it finishes loading, which covers both the
		// host loading after this plugin and the host being reloaded later.
		this.registerEvent(
			this.app.workspace.on(HOST_LOADED_EVENT, () => {
				this.registerExtension();
			}),
		);
	}

	onunload(): void {
		this.api?.unregister();
		this.api = undefined;
	}
}

declare module "obsidian" {
	interface App {
		plugins: {
			enabledPlugins: Set<string>;
		};
	}
	interface Workspace {
		on(
			name: "obsidian-local-rest-api:loaded",
			callback: () => void,
			ctx?: unknown,
		): EventRef;
	}
}
