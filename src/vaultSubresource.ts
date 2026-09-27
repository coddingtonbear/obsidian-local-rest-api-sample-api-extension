/**
 * A sub-resource under every note: `addVaultSubresource`. Extension API version 3.
 *
 * `addRoute` can't put anything under `/vault/`, because the host's own `/vault/*`
 * handler claims those paths first. A sub-resource can: registering `stats` makes
 * `/vault/<path to any note>/stats/...` and `/active/stats/...` reach the router
 * returned here, with paths relative to the sub-resource.
 */
import type { Request, RequestHandler, Response } from "express";
import type {
	LocalRestApiPublicApi,
	VaultSubresourceRequest,
} from "obsidian-local-rest-api";

import type { ExtensionContext } from "./context";
import { isNoteStatsField, measureNote, NOTE_STATS_FIELDS } from "./stats";

export const STATS_SUBRESOURCE = "stats";

/**
 * Express 4 does not catch a rejected promise from an async handler; without this a
 * thrown error would leave the request hanging instead of reaching the host's error
 * handler.
 */
function asyncHandler(
	handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
	return (request, response, next) => {
		handler(request, response).catch(next);
	};
}

export function registerVaultSubresource(
	api: LocalRestApiPublicApi,
	context: ExtensionContext,
): void {
	const stats = api.addVaultSubresource(STATS_SUBRESOURCE);

	// The host resolves the file before the router runs and attaches it to the
	// request, so a handler never has to parse the path or 404 a missing file. It does
	// so for *any* file though, which is why this checks for a markdown one.
	stats.use((request, response, next) => {
		const { vaultFile } = request as VaultSubresourceRequest;
		if (vaultFile.extension !== "md") {
			response
				.status(400)
				.json({ message: `${vaultFile.path} is not a markdown note.` });
			return;
		}
		next();
	});

	//   curl -H "Authorization: Bearer $API_KEY" \
	//     http://127.0.0.1:27123/vault/path/to/note.md/stats/
	stats.get(
		"/",
		asyncHandler(async (request, response) => {
			const { vaultFile } = request as VaultSubresourceRequest;
			response.json(await measureNote(context, vaultFile));
		}),
	);

	//   curl -H "Authorization: Bearer $API_KEY" \
	//     http://127.0.0.1:27123/vault/path/to/note.md/stats/words
	//
	// `request.params.field` is express's own decoding. When a segment may contain an
	// encoded slash (%2F), read `vaultSubresourceSegments` instead: there each segment
	// is decoded on its own, so that slash stays inside its segment.
	stats.get(
		"/:field",
		asyncHandler(async (request, response) => {
			const { vaultFile, vaultSubresourceSegments } =
				request as VaultSubresourceRequest;
			const field = vaultSubresourceSegments[0] ?? "";
			if (!isNoteStatsField(field)) {
				response.status(404).json({
					message: `Unknown field "${field}"; expected one of ${NOTE_STATS_FIELDS.join(", ")}.`,
				});
				return;
			}
			const noteStats = await measureNote(context, vaultFile);
			response.json({ [field]: noteStats[field] });
		}),
	);
}
