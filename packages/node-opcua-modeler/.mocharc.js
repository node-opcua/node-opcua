module.exports = {
   recursive: true,
   diff: true,
   extension: [".ts", ".js"],
   spec: ["test/*.ts"],
   bail: true,
   timeout: 20000,
   require: [
      "should",
      "ts-node/register",
      "source-map-support/register"
   ]
};
