var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
var csv = require("csv");

// see OPC-UA Part 6 , A2
var codeMap= {};
csv().from.stream(fs.createReadStream(__dirname+'/StatusCodes.csv')).to.array(function(data)
{
   data.forEach(function(e){
       var codeName = e[0];
       codeMap[codeName] = parseInt(e[1]);
   });
   //xx console.log(data);

   parseStatusCodeXML();

});

function parseStatusCodeXML() {

    var xmlFile = "./code_gen/UA_StatusCodes.xml";
    var sprintf = require("sprintf").sprintf;

    var parser = new xml.Parser();

    var obj = {};
    var outFile = fs.createWriteStream("lib/opcua_status_code.js");

    outFile.write("// this file has been automatically generated\n");
    outFile.write(" exports.StatusCodes = { \n");
    parser.on('startElement',function(name,attrs) {
        if ( name == "opc:Constant") {
            var cstName = attrs.Name;
            if (cstName in codeMap) {
                obj = { name:cstName,value:codeMap[cstName]};
            } else {
                console.log("cannot find",cstName);
            }
        }  else if ( name == "opc:Documentation") {

            parser.once("text",function(txt) {
                obj.description = txt;
            });
        }
    });
    parser.on("endElement",function(name){
       if ( name === "opc:TypeDictionary") {
           outFile.write("};\n");
       } else if ( name === "opc:Constant") {
           outFile.write(sprintf("  %40s: { name: %40s , value: %6d  ,description: \"%s\"}, \n",obj.name,"'"+obj.name+"'",obj.value, obj.description));
       }
    });

    parser.write(fs.readFileSync(xmlFile));

}


