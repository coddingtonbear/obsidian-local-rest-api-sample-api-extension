# Obsidian Local REST API Sample Plugin

This plugin provides an example of how you might add additional plugins to
Obsidian Local REST API.

## Instructions

1. Fork this repository.
2. Update `main.ts` to advertise your new route(s).
3. Build the project with `npm run build` (or `npm run dev` if you are iterating on some changes).
4. Link the plugin into your Obsidian vault's `.obsidian/plugins` directory.  On linux or osx, you can run `ln -s /path/to/your/cloned/fork /path/to/your/vault/.obsidian/plugins`.
5. Enable the plugin in Obsidian's Community Plugins settings page.
