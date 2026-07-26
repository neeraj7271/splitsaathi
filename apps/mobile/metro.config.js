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
// Watch only app source — avoid android/build + node_modules codegen (ENOSPC).
config.watchFolders = [
  path.join(projectRoot, "src"),
  path.join(projectRoot, "assets"),
  projectRoot
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];

config.resolver.blockList = [
  new RegExp(`${path.resolve(workspaceRoot, "apps/api").replace(/\\/g, "/")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "packages").replace(/\\/g, "/")}/.*`),
  /\/android\/build\/.*/,
  /\/android\/\.gradle\/.*/,
  /\/ios\/build\/.*/,
  /\/\.expo\/.*/,
  /\.git\/.*/,
  /terminals\/.*/
];

config.watcher = {
  ...config.watcher,
  additionalExts: config.watcher?.additionalExts,
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000
  }
};

module.exports = config;
