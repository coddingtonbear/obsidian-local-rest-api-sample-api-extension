/**
 * Documentation for this extension's routes: `addOpenApiDescription`. Extension API
 * version 4.
 *
 * The host cannot see what a route accepts or returns, so a route only appears in the
 * spec it serves at `/openapi.yaml` and `/openapi.json` when you describe it. Each field
 * below has the shape of the matching top-level field of an OpenAPI 3 document.
 */
import type {
	LocalRestApiPublicApi,
	OpenApiDescription,
} from "obsidian-local-rest-api";

import { PING_PATH, VAULT_STATS_PATH } from "./routes";
import { NOTE_STATS_FIELDS } from "./stats";
import { STATS_SUBRESOURCE } from "./vaultSubresource";

const TAG = "Sample Extension";

// Named `filename` to match the host's own `/vault/{filename}` routes.
const NOTE_PATH_PARAMETER = {
	name: "filename",
	in: "path",
	required: true,
	description: "Vault-relative path of a markdown note.",
	schema: { type: "string", format: "path" },
};

const NOTE_STATS_RESPONSE = {
	description: "Statistics for the note.",
	content: {
		"application/json": {
			schema: { $ref: "#/components/schemas/SampleExtensionNoteStats" },
		},
	},
};

export const OPENAPI_DESCRIPTION: OpenApiDescription = {
	// Tags you introduce are declared here. An operation may also use one of the
	// host's own tags ("Vault Files", say) without declaring it.
	tags: [
		{
			name: TAG,
			description: "Routes added by the Local REST API sample extension.",
		},
	],
	// Path parameters are written `{name}`, as OpenAPI requires, not express's `:name`.
	paths: {
		[VAULT_STATS_PATH]: {
			get: {
				tags: [TAG],
				summary: "Count the notes and attachments in the vault.",
				responses: {
					"200": {
						description: "Statistics for the vault.",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SampleExtensionVaultStats" },
							},
						},
					},
				},
			},
		},
		[PING_PATH]: {
			get: {
				tags: [TAG],
				summary: "Report that the sample extension is loaded.",
				// An empty list overrides the spec-wide API key requirement, which is
				// how OpenAPI says "this one needs no authentication".
				security: [],
				responses: { "200": { description: "The extension is loaded." } },
			},
		},
		[`/vault/{filename}/${STATS_SUBRESOURCE}/`]: {
			get: {
				tags: [TAG],
				summary: "Return statistics for a note.",
				parameters: [NOTE_PATH_PARAMETER],
				responses: { "200": NOTE_STATS_RESPONSE },
			},
		},
		[`/vault/{filename}/${STATS_SUBRESOURCE}/{field}`]: {
			get: {
				tags: [TAG],
				summary: "Return one statistic for a note.",
				parameters: [
					NOTE_PATH_PARAMETER,
					{
						name: "field",
						in: "path",
						required: true,
						schema: { type: "string", enum: [...NOTE_STATS_FIELDS] },
					},
				],
				responses: {
					"200": { description: "An object holding just that field." },
					"404": { description: "There is no such field." },
				},
			},
		},
		[`/active/${STATS_SUBRESOURCE}/`]: {
			get: {
				tags: [TAG],
				summary: "Return statistics for the note open in Obsidian.",
				responses: { "200": NOTE_STATS_RESPONSE },
			},
		},
	},
	// Component names share one namespace with the host and every other extension, so
	// prefix yours: a name that is already taken makes `addOpenApiDescription` throw.
	components: {
		schemas: {
			SampleExtensionVaultStats: {
				type: "object",
				required: ["notes", "attachments"],
				properties: {
					notes: { type: "integer" },
					attachments: { type: "integer" },
				},
			},
			SampleExtensionNoteStats: {
				type: "object",
				required: [...NOTE_STATS_FIELDS],
				properties: {
					path: { type: "string" },
					words: { type: "integer" },
					characters: { type: "integer" },
					headings: { type: "integer" },
					links: { type: "integer" },
					tags: { type: "array", items: { type: "string" } },
				},
			},
		},
	},
};

export function registerOpenApiDescription(api: LocalRestApiPublicApi): void {
	api.addOpenApiDescription(OPENAPI_DESCRIPTION);
}
