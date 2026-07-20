if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function toReversed() {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Keep Metro scoped to the mobile app. Without this, npm workspaces can
// make Expo treat the monorepo root as the project and crawl everything.
config.projectRoot = projectRoot;
config.watchFolders = [projectRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];

config.resolver.blockList = [
  new RegExp(`${path.resolve(workspaceRoot, "apps/api").replace(/\\/g, "/")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "packages").replace(/\\/g, "/")}/.*`),
  /\.git\/.*/,
  /terminals\/.*/
];

// Windows file watcher often times out when Metro crawls too many folders.
if (process.platform === "win32") {
  config.resolver.useWatchman = false;
  config.watcher = {
    ...config.watcher,
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 10000
    }
  };
}

module.exports = config;
