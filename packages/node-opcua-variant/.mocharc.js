module.exports = {
  require: [
    "../../node_modules/source-map-support/register",
    "../../node_modules/ts-node/register/transpile-only",
    "../../node_modules/should",
  ],
  timeout: 20000,
  extension: ["js", "ts"],
  spec: ["test/*.ts", "test/*.js"],
  bail: true
};
