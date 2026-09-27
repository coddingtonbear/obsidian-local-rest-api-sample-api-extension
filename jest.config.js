module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	testPathIgnorePatterns: ["/node_modules/"],
	moduleNameMapper: {
		"^obsidian$": "<rootDir>/mocks/obsidian.ts",
	},
	transform: {
		"\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
	},
};
