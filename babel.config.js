module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    env: {
      production: {
        plugins: [["transform-remove-console", { exclude: ["error", "warn"] }]],
      },
      // Jest's VM can't execute native dynamic import(); transpile it to
      // deferred require() in tests only (useUserProfileStore lazy-imports
      // auth-api). No effect on Metro builds.
      test: {
        plugins: ["dynamic-import-node"],
      },
    },
  };
};
