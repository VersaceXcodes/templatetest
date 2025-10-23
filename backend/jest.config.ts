module.exports = {
  "testEnvironment": "node",
  "collectCoverageFrom": [
    "src/**/*.js",
    "!src/server.js"
  ],
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  },
  "setupFilesAfterEnv": [],
  "testPathIgnorePatterns": [
    "/node_modules/",
    "/dist/"
  ],
  "moduleFileExtensions": [
    "js",
    "json",
    "node"
  ],
  "preset": "ts-jest"
};