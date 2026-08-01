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

config.projectRoot = projectRoot;
config.watchFolders = [
  projectRoot,
  path.resolve(workspaceRoot, "packages")
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules")
];

config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (typeof name === "string") {
        return path.join(workspaceRoot, "node_modules", name);
      }
      return target[name];
    }
  }
);

config.resolver.blockList = [
  new RegExp(`${path.resolve(workspaceRoot, "apps/api").replace(/\\/g, "/")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "packages/db").replace(/\\/g, "/")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "packages/testing").replace(/\\/g, "/")}/.*`),
  new RegExp(`${path.resolve(workspaceRoot, "deploy").replace(/\\/g, "/")}/.*`),
  /.*\/android\/app\/build\/.*/,
  /.*\/android\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/android\/\.cxx\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/\.expo\/.*/,
  /.*\.git\/.*/
];

module.exports = config;
