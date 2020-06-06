module.exports = {
   recursive: true,
   diff: true,
   extension: [".ts"],
   spec: ["test/*.ts"],
   bail: true,
   require: [
      "../../node_modules/should",
      "../../node_modules/ts-node/register",
      "../../node_modules/source-map-support/register"
   ]
};
