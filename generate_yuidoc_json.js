var version = require("./packages/node-opcua/package").version;
module.exports = {
    name: "The NodeOPCUA API",
    description: "The NodeOPCUA API: a library to easily create OPC UA Server and Client application with node.js",
    version: version,
    url: "http://node-opcua.github.io/",
    options: {
        outdir: "../node-opcua.github.io/api_doc/" + version,
        paths: ["packages"],
        ignorePaths: ["./packages/node-opcua-server/test/*", "./packages/**/test/*", "packages/**/test*/*"],
        exclude: "node_modules,test,_test_generated"
    },
    themedir: "../node-opcua.github.io/theme/",
    helpers: ["../node-opcua.github.io/theme/helpers/helpers.js"]
};

var fs = require("fs");
var path =require("path");

fs.writeFile(path.join(__dirname,"yuidoc.json"),JSON.stringify(module.exports,null," "),"ascii",function(err) {
    console.log("done",err);
});
