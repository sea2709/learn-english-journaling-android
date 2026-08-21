const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Nested feature worktrees install their own node_modules; watching them
// exhausts Linux inotify (ENOSPC) when starting Expo from the primary checkout.
const worktreesPattern = new RegExp(
  `${path.resolve(__dirname, ".worktrees").replace(/[/\\]/g, "[/\\\\]")}[/\\\\].*`
);
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = existingBlockList
  ? [existingBlockList, worktreesPattern].flat()
  : worktreesPattern;

config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== "wasm");
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}

const previousEnhance = config.server?.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const nextMiddleware = previousEnhance
    ? previousEnhance(middleware, metroServer)
    : middleware;
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return nextMiddleware(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: "./global.css" });
