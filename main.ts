import { Plugin } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";

export default class ObsidianLocalRESTAPISamplePlugin extends Plugin {
	private api: LocalRestApiPublicApi;

	async onload() {
		this.api = getAPI(this.app, this.manifest);

		this.api.addRoute("/my-route/").get((request, response) => {
			response.status(200).json({
				sample_plugin_response_ok: true,
			});
		});
	}

	onunload() {
		if (this.api) {
			this.api.unregister();
		}
	}
}
