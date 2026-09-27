# Obsidian Local REST API Sample API Extension

A working example of an **API extension** for [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api): an ordinary Obsidian plugin that adds its own REST routes, MCP tools, and event streams to the server that plugin runs.

It uses every part of the extension API, one part per source file, and each registration is commented with what it does and how to call it. Use it as a reference, or copy it as the starting point of your own extension.

> [!IMPORTANT]
> This sample targets **extension API version 3**, which has not been released yet. Until it is, the `obsidian-local-rest-api` dependency has to come from a local checkout of that plugin; see [Working against an unreleased host](#working-against-an-unreleased-host).

## What it adds

The sample counts things: notes in the vault, and words, headings, links, and tags in a note.

| You call | It adds | Source | Since API version |
|---|---|---|---|
| `addRoute` | `GET /sample-extension/stats/`, requiring the API key | [src/routes.ts](src/routes.ts) | 1 |
| `addPublicRoute` | `GET /sample-extension/ping/`, requiring no API key | [src/routes.ts](src/routes.ts) | 2 |
| `addMcpTool(name, …)` | The `sample_vault_stats` tool, returning JSON text | [src/mcp.ts](src/mcp.ts) | 2 |
| `addVaultSubresource` | `GET /vault/<note>/stats/` and `GET /active/stats/` | [src/vaultSubresource.ts](src/vaultSubresource.ts) | 3 |
| `addMcpTool({…})` | The `sample_note_stats` tool, with structured output and recoverable errors | [src/mcp.ts](src/mcp.ts) | 3 |
| `addMcpResource` | The `sample-extension://vault-stats` resource | [src/mcp.ts](src/mcp.ts) | 3 |
| `addMcpResourceTemplate` | The `sample-extension://note-stats/{+path}` resources | [src/mcp.ts](src/mcp.ts) | 3 |
| `addMcpPrompt` | The `sample_review_note` prompt | [src/mcp.ts](src/mcp.ts) | 3 |
| `addStreamableEvent` | The `note-measured` and `css-change` event streams | [src/events.ts](src/events.ts) | 3 |
| `addOpenApiDescription` | Documentation of the routes above in `/openapi.yaml` | [src/openapi.ts](src/openapi.ts) | 3 |
| `unregister` | Removal of all of the above when the plugin is disabled | [src/main.ts](src/main.ts) | 1 |

[src/stats.ts](src/stats.ts) holds the counting itself and knows nothing about the extension API. The other files are thin adapters over it, which is a structure worth keeping in your own extension: it is what makes the logic testable without Obsidian running.

## How an extension works

An extension asks the host plugin for a handle, registers things through it, and gives everything back when it unloads:

```ts
import { getAPI } from "obsidian-local-rest-api";

const api = getAPI(this.app, this.manifest, 3);
if (api) {
  api.addRoute("/my-route/").get((request, response) => {
    response.json({ ok: true });
  });
}

// later, in onunload():
api?.unregister();
```

Three details matter, and [src/main.ts](src/main.ts) handles all of them:

- **Load order.** `getAPI` returns `undefined` when Local REST API is not installed, not enabled, or has not finished loading. The host fires the `obsidian-local-rest-api:loaded` workspace event each time it finishes loading, so register on that event as well as in `onload`.
- **Versions.** The third argument to `getAPI` is the extension API version you need: the highest in the table above among the methods you call. The types describe every method whichever version you pass, so asking for too low a version compiles, and then fails on an older host when the method is missing. If the installed host is older, `getAPI` throws `ApiVersionUnsupportedError`, which carries `requestedVersion` and `availableVersion`. Leave the argument out to accept any host and check `api.apiVersion` yourself before calling newer methods.
- **Cleanup.** Call `unregister()` in `onunload`. It removes every route, sub-resource, MCP registration, event, and OpenAPI description the handle registered, and closes any open streams of your events.

## Creating your own extension

1. Copy this repository, and clone your copy into your vault's plugin folder, `<vault>/.obsidian/plugins/<your plugin id>/`. Cloning it elsewhere and symlinking it into that folder works too.
2. Make it yours: set `id`, `name`, `description`, and `author` in `manifest.json`, and `name` in `package.json`. The folder name must match the `id`. The `id` is also the emitter name of your event streams, so choose one that reads well in a URL.
3. Install dependencies and start the build, which rebuilds `main.js` whenever a source file changes:

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

4. In Obsidian, enable **Local REST API** and then your plugin under **Settings → Community plugins**.
5. Replace the contents of the `register*` files with your own routes and tools, and delete the ones you do not need. `src/main.ts` needs no changes beyond removing the calls to what you deleted.

Obsidian does not reload a plugin when its `main.js` changes. After a rebuild, turn your plugin off and on again under **Settings → Community plugins**, run the **Reload app without saving** command, or install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin, which does it for you.

### Dependencies

`obsidian-local-rest-api` is a development dependency. It provides `getAPI` and the types; the package is a few kilobytes, and looks up the *running* host in Obsidian's plugin registry rather than bundling it into your plugin.

Its types refer to `obsidian`, `zod`, and `@types/express`, which it declares as peer dependencies. Keep all three installed, or TypeScript quietly treats the types that depend on them as `any`.

`zod` is a regular dependency, because your plugin builds schemas with it at runtime. Use zod 3, as the host does.

### Working against an unreleased host

To build against a version of Local REST API that is not on npm yet, check it out next to this repository and run:

```bash
npm run use-local-host
```

That packs `../obsidian-local-rest-api` into `.local/` exactly as it would be published, and installs the result. Installing the checkout directly (`npm install ../obsidian-local-rest-api`) does not work: npm links to the folder, TypeScript then finds a second copy of express's and zod's types in the checkout's own `node_modules`, and the two copies do not match.

Your Obsidian also has to run that version of the host. Build the checkout with `npm run build`, and symlink or copy its `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/obsidian-local-rest-api/`.

## Trying it out

These examples use the unencrypted port, which you enable under **Settings → Local REST API → Enable HTTP server**. To use HTTPS instead, replace the address with `https://127.0.0.1:27124` and either trust the plugin's certificate or pass `-k` to curl. Your API key is on the same settings page.

```bash
export API_KEY="<your api key>"
```

### Is it registered?

`GET /` lists every registered extension, with its routes and MCP tools, under `apiExtensions`:

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/
```

### Routes

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/sample-extension/stats/
```

The public route answers without the API key:

```bash
curl http://127.0.0.1:27123/sample-extension/ping/
```

### Sub-resources of a note

Replace `path/to/note.md` with the path of a note in your vault, URL-encoding any spaces as `%20`:

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/vault/path/to/note.md/stats/
```

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/vault/path/to/note.md/stats/words
```

The same sub-resource exists for whichever note is open in Obsidian:

```bash
curl -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/active/stats/
```

### MCP tools, resources, and prompts

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) lets you list and call everything by hand:

```bash
npx @modelcontextprotocol/inspector
```

Choose the **Streamable HTTP** transport, enter `http://127.0.0.1:27123/mcp/` as the URL, and add an `Authorization` header with the value `Bearer <your api key>`. The tools, resources, and prompts in the table above appear next to the host's own.

An MCP client that is already connected is told when these lists change, so enabling or disabling the plugin does not require reconnecting.

### Event streams

Following a stream takes two requests. The first registers a subscription and returns a URL:

```bash
curl -X POST -H "Authorization: Bearer $API_KEY" http://127.0.0.1:27123/events/obsidian-local-rest-api-sample-api-extension/note-measured/
```

The second follows it. With signed URLs enabled, which is the default, the URL needs no API key:

```bash
curl -N "<url from the response>"
```

Now request a note's statistics from another terminal, as under [Sub-resources of a note](#sub-resources-of-a-note). Each request fires `note-measured`, and the stream prints the path and word count.

The subscription request accepts a [JsonLogic](https://jsonlogic.com/) filter as its body, with the content type `application/vnd.olrapi.jsonlogic+json`. It is evaluated against what your `serialize` function returned: `{">": [{"var": "words"}, 1000]}` streams only notes of more than a thousand words.

To see the second event, subscribe to `css-change` in the same way and switch themes in Obsidian.

### OpenAPI

```bash
curl http://127.0.0.1:27123/openapi.yaml
```

The routes of this extension appear under the `Sample Extension` tag, each marked with an `x-obsidian-extension` field holding the plugin's id.

## Testing without Obsidian

```bash
npm test
```

The tests run in plain Node, with two stand-ins:

- [mocks/obsidian.ts](mocks/obsidian.ts) replaces the `obsidian` package, which contains only types. It implements the few parts of Obsidian this plugin touches.
- [src/testing/fakeHost.ts](src/testing/fakeHost.ts) replaces Local REST API. It implements the same `LocalRestApiPublicApi` interface the real host does. Routes and sub-resources are mounted on a real express app, so tests make HTTP requests of them with [supertest](https://github.com/ladjs/supertest); MCP registrations, events, and OpenAPI descriptions are recorded, so tests call their callbacks directly.

Both are small enough to copy and extend. Because `FakeHost` is declared against the published interface, a change to the extension API that would break your plugin fails `npm run typecheck` before it fails in Obsidian.

## Things to know

- **Paths.** `addPublicRoute` throws for the paths the host reserves (`/`, `/openapi.yaml`, `/openapi.json`, and its certificate), and anything under `/vault/` or `/active/` is only reachable as a sub-resource. Prefix your other routes, as this sample does with `/sample-extension/`, to stay clear of the host and of other extensions.
- **Public routes** are open to anything that can reach the port. Do not return vault content from one.
- **Sub-resource names** are a single path segment. `heading`, `block`, and `frontmatter` are reserved, and a name belongs to the first extension that registers it. The router receives any file that exists, not only markdown notes, and never receives requests made with a signed URL.
- **MCP names** are shared by the host and all extensions. Registering a tool, prompt, resource URI, or resource template name that is taken throws, so prefix yours.
- **Tool errors.** Return `isError: true` for a failure the model can act on, such as a note that does not exist. Throw only when the tool itself is broken.
- **Event payloads.** Your `serialize` function decides everything a stream sends, and anyone holding a stream URL receives it. Return only what such a person should see, and `null` to send nothing.
- **Event names** are 1-128 letters, digits, or `.`, `_`, `:`, `-`, and may not be `.` or `..`. The host listens on `source` for the name you register, so for an event somebody else fires, the name has to be the one it is fired under.
- **OpenAPI names.** Paths, component names, and tags are shared too; a description that declares one that is taken throws, and nothing from that call is published. Write path parameters as `{name}`, not express's `:name`.

The host's Readme has the reference for each method under [API Extensions](https://github.com/coddingtonbear/obsidian-local-rest-api#api-extensions), and the full type definitions are in [`publicApi.d.ts`](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/main/publicApi.d.ts).

## Releasing your extension

An extension is released like any other Obsidian plugin: see Obsidian's [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) guide. Set `minAppVersion` in `manifest.json` no lower than the host's, and mention in your own Readme which version of Local REST API you need.
