module.exports = Object.assign({
  rootDir: __dirname,
  verbose: true,
  testPathIgnorePatterns: ["<rootDir>/client", "<rootDir>/tools", "node_modules"],
  collectCoverageFrom: [
    "server/**/*.{js,jsx,mjs}"
  ],
  setupFiles: [
    "<rootDir>/server/test/setup.js"
  ],
  // disable transformation
  transform: {},
  testMatch: ["<rootDir>/server/test/tests/**/*.{js,jsx,mjs}"],
  testEnvironment: "node",
  moduleFileExtensions: [
    "web.js",
    "js",
    "json",
    "web.jsx",
    "jsx",
    "node",
    "mjs"
  ]
});
