var util = require('util');
var xml = require("node-expat");
var fs = require("fs");
var csv = require("csv");
var sprintf = require("sprintf").sprintf;

// see OPC-UA Part 6 , A2
var codeMap= {};


csv().from.stream(fs.createReadStream(__dirname+'/NodeIds.csv')).to.array(function(data)
{
    //xx console.log(data);

    var metaMap = {

    };

    data.forEach(function(e) {

        var codeName = e[0];
        var value    = e[1];
        var type     = e[2];

        if (!metaMap.hasOwnProperty(type)) {
            metaMap[type]= {};
        }

        codeMap[codeName] = e;
        metaMap[type][codeName]= e;


    });
    var outFile = fs.createWriteStream("lib/opcua_node_ids.js");
    outFile.write("// this file has been automatically generated\n");

    if (false) {
        outFile.write(" exports.NodeIds = { \n");
        for(name in codeMap) {
            if (codeMap.hasOwnProperty(name)) {
                e = codeMap[name];
                var name = e[0];
                var id   = parseInt(e[1],10);
                var typeName = e[2];

                outFile.write(sprintf("  %40s: { name: %40s , value: %6d }, \n",name,"'"+name+"'",id));
            }
        }
        outFile.write("};\n");

    }

    for(typeName in metaMap) {
        if (metaMap.hasOwnProperty(typeName)) {
            typeMap = metaMap[typeName];
            outFile.write(" exports."+ typeName + "= { \n");

            for(name in typeMap) {
                if (typeMap.hasOwnProperty(name)) {
                    e = typeMap[name];
                    var name = e[0];
                    var id   = parseInt(e[1],10);
                    var type = e[2];
                    outFile.write(sprintf("  %80s: %6d , \n",name,id));
                }
            }
            outFile.write("};\n");
        }
    }



});
