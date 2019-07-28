// (e.g. typedoc --options ./typedoc.js ./src), then you can set an array of exclude paths in the configuration:
//    typedoc.js:
const path = require("path");
const fs = require("fs");

function walk(dir, pattern) {
    let results = [];
    var list = fs.readdirSync(dir);
    for(let file of list) {
                
        file = dir + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* Recurse into a subdirectory */
            results = results.concat(walk(file,pattern));
        } else { 
            /* Is a file */
            if (!file.match(pattern))  {
//                console.log("skuo", file);
               continue;
            } 
 //           console.log("Keep,",file.match(pattern),file,pattern)
            results.push(file);
        }
    };
    return results;
}

function r(arr) {
    
    let result = [];
    for (let a of arr) {
            result = result.concat(walk(path.join("../packages",a,"source"),/\.ts/))
    }
    return result;
}
module.exports = {
    src: r([ 
        "node-opcua", 
        "node-opcua-client", 
        "node-opcua-server", 
        "node-opcua-types", 
        "node-opcua-nodeid", 
        "node-opcua-variant", 
        "node-opcua-data-value", 
        "node-opcua-service-read", 
        "node-opcua-service-write", 
        "node-opcua-service-subscription", 
        "node-opcua-client-crawler", 
    ]),
    out: "./out1/",

    readme: "./readme.md",
    includes: "./",
    exclude: ["*/@types/**"],
    mode: "file",
    excludeExternals: true,
    excludeNotExported: true,
    excludePrivate: true,
    includeDeclarations: false,
    moduleResolution: "node",
    theme: "default",
    logger: "console"
};

