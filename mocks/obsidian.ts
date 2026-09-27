/**
 * A minimal stand-in for the `obsidian` package, trimmed to what this plugin touches.
 *
 * Jest maps the `obsidian` specifier here (see `jest.config.js`): the real package
 * ships only types, because Obsidian provides the implementation at runtime.
 */

type Listener = (...data: unknown[]) => unknown;

export interface EventRef {
	event: string;
	callback: Listener;
}

export class Events {
	private listeners = new Map<string, Listener[]>();

	on(event: string, callback: Listener): EventRef {
		this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]);
		return { event, callback };
	}

	off(event: string, callback: Listener): void {
		this.listeners.set(
			event,
			(this.listeners.get(event) ?? []).filter((listener) => listener !== callback),
		);
	}

	trigger(event: string, ...data: unknown[]): void {
		for (const listener of this.listeners.get(event) ?? []) {
			listener(...data);
		}
	}
}

export class TFile {
	path: string;
	extension: string;
	stat = { ctime: 0, mtime: 0, size: 0 };

	constructor(path = "note.md", mtime = 0) {
		this.path = path;
		this.extension = path.includes(".") ? (path.split(".").pop() ?? "") : "";
		this.stat.mtime = mtime;
	}
}

export interface CachedMetadata {
	headings?: { heading: string; level: number }[];
	links?: { link: string }[];
	tags?: { tag: string }[];
}

export class Vault {
	/** Test helper: the vault's files and their contents. */
	_files = new Map<TFile, string>();

	_add(path: string, content = "", mtime = 0): TFile {
		const file = new TFile(path, mtime);
		this._files.set(file, content);
		return file;
	}

	getFiles(): TFile[] {
		return [...this._files.keys()];
	}

	getMarkdownFiles(): TFile[] {
		return this.getFiles().filter((file) => file.extension === "md");
	}

	getFileByPath(path: string): TFile | null {
		return this.getFiles().find((file) => file.path === path) ?? null;
	}

	async cachedRead(file: TFile): Promise<string> {
		return this._files.get(file) ?? "";
	}
}

export class MetadataCache extends Events {
	/** Test helper: the cache entry of each file that has one. */
	_cache = new Map<TFile, CachedMetadata>();

	getFileCache(file: TFile): CachedMetadata | null {
		return this._cache.get(file) ?? null;
	}
}

export class Workspace extends Events {}

export class App {
	vault = new Vault();
	metadataCache = new MetadataCache();
	workspace = new Workspace();
	plugins = {
		enabledPlugins: new Set<string>(),
		plugins: {} as Record<string, unknown>,
	};
}

export interface PluginManifest {
	id: string;
	name: string;
	version: string;
}

export class Plugin {
	app: App;
	manifest: PluginManifest;
	/** Test helper: the event registrations Obsidian would undo on unload. */
	_eventRefs: EventRef[] = [];

	constructor(app: App, manifest: PluginManifest) {
		this.app = app;
		this.manifest = manifest;
	}

	registerEvent(eventRef: EventRef): void {
		this._eventRefs.push(eventRef);
	}
}

export class Notice {
	/** Test helper: every notice shown so far. */
	static _messages: string[] = [];

	constructor(message: string) {
		Notice._messages.push(message);
	}
}
