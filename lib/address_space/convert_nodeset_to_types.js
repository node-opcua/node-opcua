var assert = require("assert");
var factories = require("../misc/factories");
var opcua = require("../../");
var AddressSpace = require("./address_space").AddressSpace;
var fs = require("fs");
var path = require("path");
var normalize_require_file = require("../misc/utils").normalize_require_file;



function getSource(dataType_browseName){
    // return require("../../lib/misc/utils").getTempFilename("_auto_generated_SCHEMA_"+ dataType_browseName +".js");
    return path.normalize(__dirname + "/../../_generated_"+"/"+ "_auto_generated_SCHEMA_"+ dataType_browseName +".js");
}

function generateEnumerationCode(dataType,filename) {

    // create the enumeration file
    var __line = [];
    function write() {
        var str = "";
        for (var i = 0; i < arguments.length; i++) {
            str += arguments[i];
        }
        __line.push(str);
    }
    write("// --------- This code has been automatically generated !!!");
    write("var factories  = require('../lib/misc/factories');");
    write("var makeNodeId = require('../lib/datamodel/nodeid').makeNodeId;");

    write("var "+dataType.browseName+"_Schema = {");
    write("  id:  makeNodeId("+ dataType.nodeId.value + ",0),");
    write("  name: '"+ dataType.browseName + "',");
    write("  enumValues: {");
    dataType.definition.forEach(function(pair) {
        write("     " + pair.name + ": " +  pair.value+ "," );
    });
    write("  }");
    write("};");
    write("exports."+dataType.browseName+"_Schema = "+dataType.browseName+"_Schema;");
    write("exports."+dataType.browseName+" = factories.registerEnumeration(" + dataType.browseName+"_Schema);");

    fs.writeFileSync(filename, __line.join("\n"), "ascii");
}
function makeEnumeration(dataType) {

    assert(dataType);
    assert(dataType.hasOwnProperty("browseName"));
    assert(_.isArray(dataType.definition));


    var Enumeration_Schema = {
        id: dataType.nodeId,
        name: dataType.browseName,
        enumValues: {}
    };

    dataType.definition.forEach(function(pair){
        Enumeration_Schema.enumValues[pair.name] = parseInt(pair.value,10);
    });

    var filename = getSource(dataType.browseName);

    generateEnumerationCode(dataType,filename);

    //xx console.log("xxxxxxxxxxxxxxxxxxxx yyyyyyyy=",dataType.browseName,require(filename)[dataType.browseName]);
    var relative_filename = normalize_require_file(__dirname, filename);

    return require(relative_filename)[dataType.browseName];

    // return factories.registerEnumeration(Enumeration_Schema);
}
exports.makeEnumeration =makeEnumeration;



function lowerFirstLetter(str){
    return str.substr(0,1).toLowerCase()+ str.substr(1);
}

function generateStructureCode(schema) {

    // var address_space = dataType.__address_space;
    // assert(address_space.constructor.name === "AddressSpace");

    // var name = dataType.browseName;
    // assert(name.substr(-8) === "DataType");
    /// name = name.substring(0,name.length-8);

    var name = schema.name;

    var __line = [];
    function write() {
        var str = "";
        for (var i = 0; i < arguments.length; i++) {
            str += arguments[i];
        }
        __line.push(str);
    }
    write("// --------- This code has been automatically generated !!!");
    write("var factories  = require('../lib/misc/factories');");
    write("var coerceNodeId = require('./../lib/datamodel/nodeid').coerceNodeId;");
    write("var " + schema.name + "_Schema = {");
    write("    id:  coerceNodeId(\'" + schema.id.toString() +"\'),");
    ///xxwrite("    id: makeNodeId("+ schema.id.value + "," + schema.id.namespace + "),");
    write("    name: \"" + name + "\",");
    write("    fields: [");
    schema.fields.forEach(function(field){
        write("       {");
        write("           name: \"" + field.name +"\",");
        write("           fieldType: \""+field.fieldType +"\"");
        if (field.isArray) {
            write("         ,   isArray:"+(field.isArray ? "true" : false) );
        }
        if (field.documentation) {
            write("          , documentation:" + (field.documentation) + " ");
        }
        write("       },");
    });
    // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
    write("        ]");
    write("    };");
    write("exports."+name+"_Schema = "+name+"_Schema;");
    write("exports."+name+" = factories.registerObject(" + name+"_Schema);");

    var filename = getSource(name);
    fs.writeFileSync(filename, __line.join("\n"), "ascii");
}



function makeStructure(dataType) {

    var address_space = dataType.__address_space;

    assert(address_space.constructor.name === "AddressSpace");

    var name = dataType.browseName;
    assert(name.substr(-8) === "DataType");

    name = name.substring(0,name.length-8);
    // remove
    var schema = {
        id: dataType.hasEncoding,
        name: name,
        fields: [
            // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
        ]
    };

    // construct the fields
    dataType.definition.forEach(function(pair){

        var dataTypeId = opcua.resolveNodeId(pair.dataType);

        var dataType = address_space.findObject(dataTypeId);
        if (!dataType) {
            throw new Error(" cannot find description for object " + dataTypeId.toString() +
                            ". Check that this node exists in the nodeset.xml file");
        }
        var dataTypeName = dataType.browseName;
        schema.fields.push({
            name: lowerFirstLetter(pair.name),
            fieldType: dataTypeName,
            isArray: false,
            description: "some description here"
        });
    });

//    var constructor = factories.registerObject(schema);

    generateStructureCode(schema);
    var filename = getSource(schema.name);
    ///Xx console.log("xxxxxxxxxx filename",filename ,"schema.name", schema.name);
    var relative_filename = normalize_require_file(__dirname, filename);
    var constructor = require(relative_filename)[schema.name];
    ///Xx console.log("xxxxxxxxxx constructor",constructor);

    assert(_.isFunction(constructor), "expecting a constructor here");
    return constructor;

}
exports.makeStructure = makeStructure;



var nodeset = exports.nodeset = {
    ServerState: null,
    ServerStatus : null
};

var makeServerStatus = function(address_space) {

    assert(address_space instanceof AddressSpace);
    var dataType,superType;

    if (!nodeset.ServerState)   {

        dataType = address_space.findDataType("ServerState");
        assert(dataType);

        superType = address_space.findObject(dataType.subTypeOf);
        assert(superType.browseName  === "Enumeration");

        var ServerState = makeEnumeration(dataType);
        nodeset.ServerState = ServerState;
        ///Xx  console.log("xxxxxxxx Setting ServerState enumeration",nodeset.ServerState)  ;
    }

    if (!nodeset.ServerStatus){
        dataType = address_space.findDataType("ServerStatusDataType");
        assert(dataType);

        superType = address_space.findObject(dataType.subTypeOf);
        assert(superType.browseName ==="Structure");

        // finding object with encoding
        //
        //   <UAObject NodeId="i=864" BrowseName="Default Binary" SymbolicName="DefaultBinary">
        //   <DisplayName>Default Binary</DisplayName>
        //   <References>
        //       <Reference ReferenceType="HasEncoding" IsForward="false">i=862</Reference>

        var ServerStatus = makeStructure(dataType);
        nodeset.ServerStatus = ServerStatus;
        ///Xx  console.log("xxxxxxxx Setting ServerStatus ",nodeset.ServerStatus)  ;

    }

};
exports.makeServerStatus =  makeServerStatus;