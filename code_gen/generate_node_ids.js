"use strict";
const fs = require("fs");
const path = require("path");
const csv = require("csv");
const sprintf = require("sprintf-js").sprintf;

const datafolder = path.join(__dirname, "1.04");

// see OPC-UA Part 6 , A2
const codeMap = {};

const parser = csv.parse({ delimiter: "," }, function (err, data) {
    convert(data);
});

fs.createReadStream(path.join(datafolder, "/NodeIds.csv")).pipe(parser);


function convert(data) {
    let name, id, type, codeName, value, typeName;
    const metaMap = {};

    data.forEach(function (row) {

        codeName = row[0];
        value = row[1];
        type = row[2];

        if (!metaMap.hasOwnProperty(type)) {
            metaMap[type] = {};
        }

        codeMap[codeName] = row;
        metaMap[type][codeName] = row;


    });
    const outFile = fs.createWriteStream(path.join("../packages/node-opcua-constants/source", "opcua_node_ids.ts"));
    outFile.write("// this file has been automatically generated\n");
    outFile.write("// using code_gen/generate_node_ids.js\n");

    let e;
    if (false) {
        outFile.write(" exports.NodeIds = { \n");
        for (let name in codeMap) {
            if (codeMap.hasOwnProperty(name)) {
                e = codeMap[name];
                name = e[0];
                id = parseInt(e[1], 10);
                typeName = e[2];

                outFile.write(sprintf("  %40s: { name: %40s , value: %6d },\n", name, "'" + name + "'", id));
            }
        }
        outFile.write("};\n");

    }

    let typeMap;
    for (typeName in metaMap) {
        if (metaMap.hasOwnProperty(typeName)) {
            typeMap = metaMap[typeName];
            outFile.write(" export enum " + typeName + "Ids {\n");

            const names = Object.keys(typeMap);

            for (let i = 0; i < names.length; i++) {
                name = names[i];

                if (typeMap.hasOwnProperty(name)) {
                    e = typeMap[name];
                    name = e[0];
                    id = parseInt(e[1], 10);
                    type = e[2];
                    if (i + 1 < names.length) {
                        outFile.write(sprintf("  %80s= %6d ,\n", name, id));
                    } else {
                        outFile.write(sprintf("  %80s= %6d\n", name, id));
                    }
                }
            }
            outFile.write("}\n");
        }
    }
    console.log("done");
}
