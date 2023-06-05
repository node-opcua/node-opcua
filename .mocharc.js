module.exports = {
  require: [
    "source-map-support/register",
    "ts-node/register/transpile-only",
    "should",
  ],
  timeout: 20000,
  extension: ["js", "ts"],
  bail: true
};
