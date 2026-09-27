/**
 * REST routes: `addRoute` and `addPublicRoute`. Available since extension API version 1
 * (`addPublicRoute` since version 2).
 *
 * Both return an express `IRoute`, so you chain `.get()`, `.post()`, `.put()`,
 * `.patch()`, and `.delete()` handlers onto them exactly as you would in any express
 * app: https://expressjs.com/en/4x/api.html#router.route
 */
import type { LocalRestApiPublicApi } from "obsidian-local-rest-api";

import type { ExtensionContext } from "./context";
import { getVaultStats } from "./stats";

export const VAULT_STATS_PATH = "/sample-extension/stats/";
export const PING_PATH = "/sample-extension/ping/";

export function registerRoutes(
	api: LocalRestApiPublicApi,
	context: ExtensionContext,
): void {
	// An authenticated route. The host has already checked the API key by the time
	// your handler runs; a request without one is answered with a 401 for you.
	//
	//   curl -H "Authorization: Bearer $API_KEY" \
	//     http://127.0.0.1:27123/sample-extension/stats/
	api.addRoute(VAULT_STATS_PATH).get((_request, response) => {
		response.json(getVaultStats(context.app));
	});

	// A public route: reachable by anyone who can reach the port, no API key needed.
	// Never return vault content from one of these.
	//
	//   curl http://127.0.0.1:27123/sample-extension/ping/
	api.addPublicRoute(PING_PATH).get((_request, response) => {
		response.json({ ok: true, extension: context.pluginId });
	});
}
