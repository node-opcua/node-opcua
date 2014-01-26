var util = require('util');
var xml = require("node-expat");
var fs = require("fs");

var xmlFile = "./code_gen/UA_StatusCodes.xml";
var sprintf = require("sprintf").sprintf;

var parser = new xml.Parser();

var counter = 1;


var outFile = fs.createWriteStream("lib/opcua_status_code.js");

outFile.write("// this file has been automatically generated\n");
outFile.write(" exports.StatusCodes = { \n");
parser.on('startElement',function(name,attrs) {
    if ( name == "opc:Constant") {
        var cstName = attrs.Name;

        outFile.write(sprintf("  %40s: { name: %40s , value: %6d }, \n",cstName,"'"+cstName+"'",counter));
        counter+=1;
    } else {
    }
});
parser.on("endElement",function(name){
   if ( name === "opc:TypeDictionary") {
       outFile.write("};\n");
   }
});


parser.write(fs.readFileSync(xmlFile));


