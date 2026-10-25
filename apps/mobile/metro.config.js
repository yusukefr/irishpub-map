const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appReactPath = require.resolve("react", { paths: [projectRoot] });
const appReactDirectory = path.dirname(appReactPath);
const config = getDefaultConfig(projectRoot);

// Mobile bundleではworkspaceから解決されるReactを明示的に使います。
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const resolvedReactPath =
      moduleName === "react" ? appReactPath : path.join(appReactDirectory, moduleName.slice("react/".length));

    return context.resolveRequest(context, resolvedReactPath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
