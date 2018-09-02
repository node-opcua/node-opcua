/**
 * utility to generate source file ./lib/raw_status_codes.js from  Opc.Ua.StatusCodes.csv
 *
 */
const util = require('util');
const xml = require("ersatz-node-expat");
const fs = require("fs");
const path = require("path");
const csv = require("csv");
const sprintf = require("sprintf-js").sprintf;



// see OPC-UA Part 6 , A2
const codeMap = {};
const code_list = [];


const datafolder = path.join(__dirname,"1.03");

csv().from.stream(fs.createReadStream(path.join(datafolder,'/Opc.Ua.StatusCodes.csv')).to.array(function (data) {
    data.forEach(function (e) {
        const codeName = e[0];
        console.log(e);
        code_list.push({
            name: e[0],
            value: parseInt(e[1],16),
            description: e[2]
        });
        codeMap[codeName] = parseInt(e[1],16);
    });
    //xx console.log(data);

    console.log("codeMap" , codeMap);
    parseStatusCodeXML();

}));

function parseStatusCodeXML() {

    const xmlFile = __dirname + "/UA_StatusCodes.xml";

    const parser = new xml.Parser();

    const obj = {};
    const outFile = fs.createWriteStream(__dirname + "/../lib/raw_status_codes.js");

    outFile.write("// this file has been automatically generated\n");

    outFile.write(" exports.StatusCodes = { \n");

    outFile.write("  Good: { name:'Good', value: 0, description:'No Error' }\n");


    const sep=",";

    code_list.forEach(function(obj){
        const s = sprintf("%1s %40s: { name: %40s , value: %6s  ,description: \"%s\"}\n",
            sep, obj.name, "'" + obj.name + "'", "0x"+obj.value.toString(16), obj.description);
        outFile.write(s);
    });
    outFile.write("};\n");
}


