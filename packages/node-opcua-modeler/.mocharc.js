module.exports = {
   recursive: true,
   diff: true,
   extension: [".ts", ".js"],
   spec: ["test/*.ts"],
   bail: true,
   timeout: 20000,
   require: [
      "../../node_modules/should",
      "../../node_modules/ts-node/register",
      "../../node_modules/source-map-support/register"
   ]
};
