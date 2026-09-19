module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    env: {
      production: {
        // Security audit finding: several console.warn sites pass raw
        // error/response objects that can carry a user's email or other
        // server-message content (e.g. lib/api.ts's failed-request logs).
        // console.error is kept for genuine crash-adjacent visibility;
        // console.warn no longer survives release builds.
        plugins: [["transform-remove-console", { exclude: ["error"] }]],
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
