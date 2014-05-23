var util = require('util');
var fs = require("fs");
var csv = require("csv");
var sprintf = require("sprintf").sprintf;

// see OPC-UA Part 6 , A2
var codeMap= {};


csv().from.stream(fs.createReadStream(__dirname+'/NodeIds.csv')).to.array(function(data)
{
    //xx console.log(data);
    var name,id,type,codeName,value,typeName;
    var metaMap = {

    };

    data.forEach(function(e) {

        codeName = e[0];
        value    = e[1];
        type     = e[2];

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
                name = e[0];
                id   = parseInt(e[1],10);
                typeName = e[2];

                outFile.write(sprintf("  %40s: { name: %40s , value: %6d }, \n",name,"'"+name+"'",id));
            }
        }
        outFile.write("};\n");

    }

    for(typeName in metaMap) {
        if (metaMap.hasOwnProperty(typeName)) {
            typeMap = metaMap[typeName];
            outFile.write(" exports."+ typeName + "Ids = { \n");

            var names = Object.keys(typeMap);

            for(var i=0;i< names.length;i++) {
                name = names[i];

                if (typeMap.hasOwnProperty(name)) {
                    e = typeMap[name];
                    name = e[0];
                    id   = parseInt(e[1],10);
                    type = e[2];
                    if (i +1 <names.length) {
                        outFile.write(sprintf("  %80s: %6d , \n",name,id));
                    } else {
                        outFile.write(sprintf("  %80s: %6d  \n",name,id));
                    }
                }
            }
            outFile.write("};\n");
        }
    }



});
