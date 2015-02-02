/**
 * utility to generate source file ./lib/raw_status_codes.js from  Opc.Ua.StatusCodes.csv
 *
 */
var util = require('util');
var xml = require("ersatz-node-expat");
var fs = require("fs");
var csv = require("csv");
var sprintf = require("sprintf").sprintf;



// see OPC-UA Part 6 , A2
var codeMap = {};
var code_list = [];

csv().from.stream(fs.createReadStream(__dirname + '/Opc.Ua.StatusCodes.csv')).to.array(function (data) {
    data.forEach(function (e) {
        var codeName = e[0];
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

});

function parseStatusCodeXML() {

    var xmlFile = __dirname + "/UA_StatusCodes.xml";

    var parser = new xml.Parser();

    var obj = {};
    var outFile = fs.createWriteStream(__dirname + "/../lib/raw_status_codes.js");

    outFile.write("// this file has been automatically generated\n");

    outFile.write(" exports.StatusCodes = { \n");

    outFile.write("  Good: { name:'Good', value: 0, description:'No Error' }\n");


    var sep=",";

    code_list.forEach(function(obj){
        var s = sprintf("%1s %40s: { name: %40s , value: %6s  ,description: \"%s\"}\n",
            sep, obj.name, "'" + obj.name + "'", "0x"+obj.value.toString(16), obj.description);
        outFile.write(s);
    });
    outFile.write("};\n");
}


