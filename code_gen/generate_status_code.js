/**
 * utility to generate source file ./lib/raw_status_codes.js from  Opc.Ua.StatusCodes.csv
 *
 */
const util = require("util");
const xml = require("ersatz-node-expat");
const fs = require("fs");
const path = require("path");
const csv = require("csv");
const sprintf = require("sprintf-js").sprintf;


// see OPC-UA Part 6 , A2
const codeMap = {};
const code_list = [];


const datafolder = path.join(__dirname, "1.04");


const parser = csv.parse({
    delimiter: "@"
}).on("readable", function () {

    let record;
    while (!!(record = this.read())) {
        record = record[0].split(",");
        const codeName = record[0];
        console.log(record.length ,record);
        code_list.push({
            name: record[0],
            value: parseInt(record[1], 16),
            description: record.slice(2).join(",")
        });
        codeMap[codeName] = parseInt(record[1], 16);
    }
}).on("end", function () {
    console.log("codeMap", codeMap);
    parseStatusCodeXML();
});

fs.createReadStream(path.join(datafolder, "/StatusCode.csv")).pipe(parser);

function parseStatusCodeXML() {

    const xmlFile = __dirname + "/UA_StatusCodes.xml";

    const parser = new xml.Parser();

    const obj = {};
    const outFile = fs.createWriteStream(__dirname + "/../packages/node-opcua-constants/source/raw_status_codes.ts");
    outFile.write(`
/**
 * @module node-opcua-constants
 */
// this file has been automatically generated

export interface IStatusCodeDescription {
        name: string;
        value: number;
        description: string | undefined;
    }
`);

    outFile.write(" export const StatusCodes: any = { \n");

    outFile.write("  Good: { name:'Good', value: 0, description:'No Error' }\n");


    const sep = ",";

    code_list.forEach(function (obj) {
        const s = sprintf("%1s %40s: { name: %40s , value: %6s  ,description: \"%s\"}\n",
          sep, obj.name, "\"" + obj.name + "\"", "0x" + obj.value.toString(16), obj.description);
        outFile.write(s);
    });
    outFile.write("};\n");
}


