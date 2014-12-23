var assert = require("assert");
var factories = require("../misc/factories");
//var opcua = require("../../");
var AddressSpace = require("./address_space").AddressSpace;
var ObjectType = require("./objectType").ObjectType;
var UADataType = require("./data_type").UADataType;

var fs = require("fs");
var path = require("path");
var normalize_require_file = require("../misc/utils").normalize_require_file;
var _ = require("underscore");
var resolveNodeId = require("../datamodel/nodeid").resolveNodeId;


function LineFile() {
    this.__line = [];

    this.write("// --------- This code has been automatically generated !!! "+ (new Date()).toString() );
}

LineFile.prototype.write = function() {
    var str = "";
    for (var i = 0; i < arguments.length; i++) {
        str += arguments[i];
    }
    this.__line.push(str);
};

LineFile.prototype.save = function(filename) {
    fs.writeFileSync(filename, this.__line.join("\n"), "ascii");
};

/**
 * returns the location of the  javascript version of the schema  corresponding to schemaName
 * @method getSchemaSourceFile
 * @param schemaName {string}
 * @param schema_type {string}  "enum" | "schema"
 * @returns {string}
 * @private
 */
function getSchemaSourceFile(schemaName,schema_type){

    if( !(schema_type === "enum" || schema_type === "schema" || schema_type === "")) {
        throw new Error(" unexpected schema_type" + schema_type);
    }

    var folder =path.normalize(path.join(__dirname, "/../../schemas"));

    if (schema_type === "") {
        return  path.join(folder,schemaName + ".js");
    } else {
        return  path.join(folder,schemaName + "_" + schema_type + ".js");
    }
}


/**
 * convert a nodeset enumeration into a javascript script enumeration code
 * @method generateEnumerationCode
 * @param dataType
 * @param filename {string} the output filename
 *
 */
function generateEnumerationCode(dataType,filename) {

    // create the enumeration file
    var f = new LineFile();
    // f.write("// --------- This code has been automatically generated !!!");
    f.write("var factories  = require('../lib/misc/factories');");
    f.write("var makeNodeId = require('../lib/datamodel/nodeid').makeNodeId;");

    f.write("var "+dataType.browseName+"_Schema = {");
    f.write("  id:  makeNodeId("+ dataType.nodeId.value + ",0),");
    f.write("  name: '"+ dataType.browseName + "',");
    f.write("  enumValues: {");
    dataType.definition.forEach(function(pair) {
        f.write("     " + pair.name + ": " +  pair.value+ "," );
    });
    f.write("  }");
    f.write("};");
    f.write("exports."+dataType.browseName+"_Schema = "+dataType.browseName+"_Schema;");
    f.write("exports."+dataType.browseName+" = factories.registerEnumeration(" + dataType.browseName+"_Schema);");
    f.save(filename);
}

/**
 * var dataType = {
 *    browseName: "Color",
 *    definition: [
 *      { name: "Red",  value: 12},
 *      { name: "Blue", value: 11}
 *    ]
 * };
 *
 * makeEnumeration(dataType);
 *
 * @param dataType
 * @returns {*}
 */
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

    var filename = getSchemaSourceFile(dataType.browseName,"enum");

    generateEnumerationCode(dataType,filename);

    var relative_filename = normalize_require_file(__dirname, filename);

    return require(relative_filename)[dataType.browseName];
}

exports.makeEnumeration =makeEnumeration;



function lowerFirstLetter(str){
    return str.substr(0,1).toLowerCase()+ str.substr(1);
}


function generateStructureCode(schema) {

    var name = schema.name;

    var f = new LineFile();

    // f.write("// --------- This code has been automatically generated !!!");
    f.write("var factories  = require('../lib/misc/factories');");
    f.write("var coerceNodeId = require('./../lib/datamodel/nodeid').coerceNodeId;");
    f.write("var " + schema.name + "_Schema = {");
    f.write("    id:  coerceNodeId(\'" + schema.id.toString() +"\'),");
    f.write("    name: \"" + name + "\",");
    f.write("    fields: [");
    schema.fields.forEach(function(field){
        f.write("       {");
        f.write("           name: \"" + field.name +"\",");
        f.write("           fieldType: \""+field.fieldType +"\"");
        if (field.isArray) {
            f.write("         ,   isArray:"+(field.isArray ? "true" : false) );
        }
        if (field.documentation) {
            f.write("          , documentation:" + (field.documentation) + " ");
        }
        f.write("       },");
    });
    f.write("        ]");
    f.write("    };");
    f.write("exports."+name+"_Schema = "+name+"_Schema;");
    //xx write("exports."+name+" = factories.registerObject(" + name+"_Schema);");

    var filename = getSchemaSourceFile(name,"schema");
    f.save(filename);

}

function generateFileCode(schema) {

    var f = new LineFile();


    var name = schema.name;
    f.write("var  registerObject = require(\"../lib/misc/factories\").registerObject;");
    // f.write("registerObject('_generated_schemas|"+ name + "','_generated_schemas');");
    f.write("registerObject('"+ name + "');");

    // var filename = "../_generated_schemas/_auto_generated_"+ name;
    var filename = "../_generated_/_auto_generated_"+ name;
    f.write("var "+  name + " = require('" + filename+ "')."+name+";");
    f.write("exports."+ name +" = " + name + ";");

    var filename = getSchemaSourceFile(name,"");
    f.save(filename);
}

/**
 * @example:
 *    var dataType =  {
 *       browseName: "ServerStatusDataType",
 *       definition: [
 *           { name "timeout", dataType: "UInt32" }
 *       ]
 *    };
 * @param dataType
 * @returns {*}
 */
function makeStructure(dataType) {

    var address_space = dataType.__address_space;

    assert(address_space.constructor.name === "AddressSpace");

    var name = dataType.browseName;
    assert(name.substr(-8) === "DataType");

    assert(dataType instanceof UADataType);

    // remove Datatype to get the name of the class
    name = name.substring(0,name.length-8);

    //xx console.log(" xxxxxxxxxxxxxxxxxxxxxx ".red.bold,dataType);
    //xx console.log(" xxxxxxxxxxxxxxxxxxxxxx ".green.bold,dataType.findReferences("HasEncoding",false));
    //xx console.log(" xxxxxxxxxxxxxxxxxxxxxx ".green.bold,dataType.findReferences("HasEncoding",true));
    //xx console.log(" xxxxxxxxxxxxxxxxxxxxxx XML".yellow,dataType.getEncodingNodeId("Default XML").toString());
    console.log(" xxxxxxxxxxxxxxxxxxxxxx Binary".yellow,dataType.getEncodingNodeId("Default Binary").nodeId.toString());

    var schema = {
        id: dataType.binaryEncodingNodeId,
        name: name,
        fields: [
            // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
        ]
    };

    // construct the fields
    dataType.definition.forEach(function(pair){

        var dataTypeId = resolveNodeId(pair.dataType);

        var dataType = address_space.findObject(dataTypeId);
        if (!dataType) {
            throw new Error(" cannot find description for object " + dataTypeId +
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


    generateFileCode(schema);

    generateStructureCode(schema);

    var filename = getSchemaSourceFile(schema.name , "");

    var relative_filename = normalize_require_file(__dirname, filename);

    console.log("xxxxxxxxxxxxxxxxxx => ".green,schema.name,filename.cyan,relative_filename.yellow);

    var constructor = require(relative_filename)[schema.name];
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
    }

};
exports.makeServerStatus =  makeServerStatus;