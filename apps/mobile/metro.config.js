const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const appReactPath = require.resolve("react", { paths: [projectRoot] });
const appReactDirectory = path.dirname(appReactPath);
const config = getDefaultConfig(projectRoot);

// WebとMobileは異なるSDK互換React版を使うため、Mobile bundle内ではMobile版に揃えます。
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const resolvedReactPath =
      moduleName === "react" ? appReactPath : path.join(appReactDirectory, moduleName.slice("react/".length));

    return context.resolveRequest(context, resolvedReactPath, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
