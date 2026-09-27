/**
 * A stand-in for Obsidian Local REST API, for unit tests.
 *
 * It implements the same `LocalRestApiPublicApi` interface the real host hands to an
 * extension. Routes and vault sub-resources are mounted on a real express app, so a
 * test can make requests of them with supertest; everything else is recorded, so a
 * test can call the callbacks directly.
 */
import express from "express";
import type { App, Events, TFile } from "obsidian";
import type {
	LocalRestApiPublicApi,
	McpPromptDefinition,
	McpResourceDefinition,
	McpResourceTemplateDefinition,
	McpToolAnnotations,
	McpToolDefinition,
	OpenApiDescription,
	StreamableEventDefinition,
	VaultSubresourceRequest,
} from "obsidian-local-rest-api";
import type { z } from "zod";

import type { ExtensionContext } from "../context";

export const API_KEY = "test-api-key";
export const PLUGIN_ID = "sample-extension-under-test";

/** A tool registered with the positional form of `addMcpTool`. */
export interface SimpleTool {
	name: string;
	description: string;
	schema: Record<string, z.ZodTypeAny>;
	callback: (args: Record<string, unknown>) => Promise<unknown>;
	annotations?: McpToolAnnotations;
}

export class FakeHost {
	apiVersion = 3;
	simpleTools: SimpleTool[] = [];
	tools: McpToolDefinition[] = [];
	resources: McpResourceDefinition[] = [];
	resourceTemplates: McpResourceTemplateDefinition[] = [];
	prompts: McpPromptDefinition[] = [];
	events = new Map<string, StreamableEventDefinition>();
	openApiDescriptions: OpenApiDescription[] = [];
	unregisterCalls = 0;

	/** Make requests of this with supertest. */
	readonly server = express();
	private publicRouter = express.Router();
	private router = express.Router();
	private subresources = new Map<string, express.Router>();

	constructor(private app: App) {
		this.server.use(this.publicRouter);
		this.server.use((request, response, next) => {
			if (request.get("Authorization") !== `Bearer ${API_KEY}`) {
				response.status(401).json({ message: "Unauthorized" });
				return;
			}
			next();
		});
		this.server.use("/vault", (request, response, next) => {
			this.dispatchSubresource(request, response, next);
		});
		this.server.use(this.router);
	}

	/** Routes `/vault/<file path>/<sub-resource name>/...` the way the host does. */
	private dispatchSubresource(
		request: express.Request,
		response: express.Response,
		next: express.NextFunction,
	): void {
		for (const file of this.app.vault.getFiles()) {
			for (const [name, router] of this.subresources) {
				const prefix = `/${encodeURI(file.path)}/${name}`;
				if (request.path !== prefix && !request.path.startsWith(`${prefix}/`)) {
					continue;
				}
				const remainder = request.path.slice(prefix.length);
				const subresourceRequest = request as VaultSubresourceRequest;
				subresourceRequest.vaultFile = file;
				subresourceRequest.vaultSubresourceSegments = remainder
					.split("/")
					.filter((segment) => segment !== "")
					.map((segment) => decodeURIComponent(segment));
				request.url = remainder === "" ? "/" : remainder;
				router(request, response, next);
				return;
			}
		}
		next();
	}

	/** Builds the handle an extension would get from `getAPI`. */
	get api(): LocalRestApiPublicApi {
		const addMcpTool = (
			nameOrDefinition: string | McpToolDefinition,
			description?: string,
			schema?: Record<string, z.ZodTypeAny>,
			callback?: (args: Record<string, unknown>) => Promise<unknown>,
			annotations?: McpToolAnnotations,
		): void => {
			if (typeof nameOrDefinition !== "string") {
				this.tools.push(nameOrDefinition);
				return;
			}
			if (description === undefined || !schema || !callback) {
				throw new Error("addMcpTool needs a description, a schema, and a callback.");
			}
			this.simpleTools.push({
				name: nameOrDefinition,
				description,
				schema,
				callback,
				annotations,
			});
		};

		return {
			apiVersion: this.apiVersion,
			addRoute: (path) => this.router.route(path),
			addPublicRoute: (path) => this.publicRouter.route(path),
			addVaultSubresource: (name) => {
				const router = express.Router();
				this.subresources.set(name, router);
				return router;
			},
			addMcpTool,
			addMcpResource: (definition) => void this.resources.push(definition),
			addMcpResourceTemplate: (definition) =>
				void this.resourceTemplates.push(definition),
			addMcpPrompt: (definition) => void this.prompts.push(definition),
			addStreamableEvent: (event, definition) => void this.events.set(event, definition),
			addOpenApiDescription: (description) =>
				void this.openApiDescriptions.push(description),
			unregister: () => {
				this.unregisterCalls += 1;
			},
		};
	}

	/**
	 * Installs this fake where `getAPI` looks for the real host: Obsidian's plugin
	 * registry.
	 */
	install(): void {
		const registry = this.app as unknown as {
			plugins: { enabledPlugins: Set<string>; plugins: Record<string, unknown> };
		};
		registry.plugins.enabledPlugins.add("obsidian-local-rest-api");
		registry.plugins.plugins["obsidian-local-rest-api"] = {
			getPublicApi: () => this.api,
		};
	}
}

export function makeContext(app: App, events: Events): ExtensionContext {
	return { app, pluginId: PLUGIN_ID, events };
}

/** Adds a file to the mocked vault; see `mocks/obsidian.ts`. */
export function addFile(
	app: App,
	path: string,
	content = "",
	mtime = 0,
): TFile {
	const vault = app.vault as unknown as {
		_add(path: string, content: string, mtime: number): TFile;
	};
	return vault._add(path, content, mtime);
}
