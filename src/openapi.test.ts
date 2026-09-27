import { App } from "obsidian";

import { OPENAPI_DESCRIPTION, registerOpenApiDescription } from "./openapi";
import { FakeHost } from "./testing/fakeHost";

describe("the OpenAPI description", () => {
	test("is handed to the host", () => {
		const host = new FakeHost(new App());

		registerOpenApiDescription(host.api);

		expect(host.openApiDescriptions).toEqual([OPENAPI_DESCRIPTION]);
	});

	test("describes every route the extension registers", () => {
		expect(Object.keys(OPENAPI_DESCRIPTION.paths ?? {})).toEqual([
			"/sample-extension/stats/",
			"/sample-extension/ping/",
			"/vault/{filename}/stats/",
			"/vault/{filename}/stats/{field}",
			"/active/stats/",
		]);
	});

	test("refers only to tags and schemas it declares", () => {
		const text = JSON.stringify(OPENAPI_DESCRIPTION.paths);
		const schemas = Object.keys(OPENAPI_DESCRIPTION.components?.schemas ?? {});
		const tags = (OPENAPI_DESCRIPTION.tags ?? []).map((tag) => tag.name);

		const referenced = [...text.matchAll(/#\/components\/schemas\/(\w+)/g)].map(
			(match) => match[1],
		);
		const used = [...text.matchAll(/"tags":\["([^"]+)"\]/g)].map((match) => match[1]);

		expect(schemas).toEqual(expect.arrayContaining(referenced));
		expect(tags).toEqual(expect.arrayContaining(used));
	});
});
