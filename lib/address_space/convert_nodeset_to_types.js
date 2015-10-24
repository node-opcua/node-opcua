"use strict";

require("requirish")._(module);

var assert = require("better-assert");
//var opcua = require("lib/../");
var AddressSpace = require("lib/address_space/address_space").AddressSpace;
var UADataType = require("lib/address_space/ua_data_type").UADataType;

var path = require("path");
var normalize_require_file = require("lib/misc/utils").normalize_require_file;
var _ = require("underscore");
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;

var LineFile = require("lib/misc/linefile").LineFile;

var crypto = require("crypto");
function hashNamespace(namespaceUri) {
    var hash =  crypto.createHash('sha1').update(namespaceUri).digest("hex");
    return hash;
}


/**
 * returns the location of the  javascript version of the schema  corresponding to schemaName
 * @method getSchemaSourceFile
 * @param namespace {String}
 * @param schemaName {String}
 * @param schema_type {String}  "enum" | "schema"
 * @return {string}
 * @private
 */
function getSchemaSourceFile(namespace, schemaName, schema_type) {

    assert(schemaName.match(/[a-zA-Z]+/));

    if (!(schema_type === "enum" || schema_type === "schema" || schema_type === "")) {
        throw new Error(" unexpected schema_type" + schema_type);
    }
    var subfolder = hashNamespace(namespace);

    var root = path.join(__dirname, "/../../schemas");
    var folder = path.normalize(path.join(root,subfolder));

    var fs = require("fs");
    if (!fs.existsSync(folder)){
        fs.mkdirSync(folder);
    }
    if (schema_type === "") {
        return path.join(folder, schemaName + ".js");
    } else {
        return path.join(folder, schemaName + "_" + schema_type + ".js");
    }
}

var factories  = require("lib/misc/factories_enumerations");
/**
 * convert a nodeset enumeration into a javascript script enumeration code
 * @method generateEnumerationCode
 * @param dataType
 * @param filename {string} the output filename
 *
 */
function generateEnumerationCode(dataType, filename) {
    assert(typeof filename === "string");

    var dataTypeName = dataType.browseName.name.toString();
    assert(!factories.hasEnumeration(dataTypeName));


    // create the enumeration file
    var f = new LineFile();
    f.write("// namespace " + dataType.namespaceUri.toString());
    f.write("require(\"requirish\")._(module);");
    f.write("var factories  = require(\"lib/misc/factories\");");
    f.write("var makeNodeId = require(\"lib/datamodel/nodeid\").makeNodeId;");


    f.write("var " + dataTypeName + "_Schema = {");
    f.write("  id:  makeNodeId(" + dataType.nodeId.value + "," + dataType.nodeId.namespace + "),");
    f.write("  name: '" + dataTypeName + "',");
    f.write("  namespace: '" + dataType.nodeId.namespace + "',");

    f.write("  enumValues: {");
    dataType.definition.forEach(function (pair) {
        f.write("     " + pair.name + ": " + pair.value + ",");
    });
    f.write("  }");
    f.write("};");
    f.write("exports." + dataTypeName + "_Schema = " + dataTypeName + "_Schema;");
    f.write("exports." + dataTypeName + " = factories.registerEnumeration(" + dataTypeName + "_Schema);");
    f.save(filename);
}

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
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
 * @method makeEnumeration
 *
 * @param dataType {Object}
 * @return {*}
 */
function makeEnumeration(dataType,bForce) {

    assert(dataType);
    assert(dataType.hasOwnProperty("browseName"));
    assert(dataType.browseName instanceof QualifiedName);
    assert(_.isArray(dataType.definition));

    var dataTypeName = dataType.browseName.name.toString();
    if (factories.hasEnumeration(dataTypeName)) {
        return factories.getEnumeration(dataTypeName).typedEnum;
    }
    //var Enumeration_Schema = {
    //    id: dataType.nodeId,
    //    name: dataType.browseName.toString(),
    //    enumValues: {}
    //};
    //
    //dataType.definition.forEach(function (pair) {
    //    Enumeration_Schema.enumValues[pair.name] = parseInt(pair.value, 10);
    //});

    var namespace = dataType.namespaceUri;
    var filename = getSchemaSourceFile(namespace,dataType.browseName.toString(), "enum");


    generateEnumerationCode(dataType, filename);

    var relative_filename = normalize_require_file(__dirname, filename);

    return require(relative_filename)[dataType.browseName.toString()];
}

exports.makeEnumeration = makeEnumeration;


var lowerFirstLetter = require("lib/misc/utils").lowerFirstLetter;


function generateStructureCode(namespace,schema) {

    var name = schema.name;

    var f = new LineFile();

    f.write("require(\"requirish\")._(module);");
    f.write("var factories  = require(\"lib/misc/factories\");");
    f.write("var coerceNodeId = require(\"lib/datamodel/nodeid\").coerceNodeId;");
    f.write("var " + schema.name + "_Schema = {");
    f.write("    id:  coerceNodeId(\'" + schema.id.toString() + "\'),");
    f.write("    name: \"" + name + "\",");
    f.write("    fields: [");
    schema.fields.forEach(function (field) {
        f.write("       {");
        f.write("           name: \"" + field.name + "\",");
        f.write("           fieldType: \"" + field.fieldType + "\"");
        if (field.isArray) {
            f.write("         ,   isArray:" + (field.isArray ? "true" : false));
        }
        if (field.description) {
            f.write("          , documentation:"  +  " \"" + (field.description) + "\" ");
        }
        f.write("       },");
    });
    f.write("        ]");
    f.write("    };");
    f.write("exports." + name + "_Schema = " + name + "_Schema;");
    //xx write("exports."+name+" = factories.registerObject(" + name+"_Schema);");

    var filename = getSchemaSourceFile(namespace,name, "schema");
    f.save(filename);

}

function generateFileCode(namespace,schema) {

    assert(typeof namespace === "string");

    var f = new LineFile();

    var name = schema.name;
    var hint = "schemas/"+hashNamespace(namespace);

    f.write("// namespace " + namespace.toString());
    f.write("require(\"requirish\")._(module);");
    f.write("var  registerObject = require(\"lib/misc/factories\").registerObject;");
    // f.write("registerObject('_generated_schemas|"+ name + "','_generated_schemas');");
    f.write("registerObject('" + hint + "|" +  name + "');");

    // var filename = "../_generated_schemas/_auto_generated_"+ name;
    var filename = "_generated_/_auto_generated_" + name;
    f.write("var " + name + " = require(\"" + filename + "\")." + name + ";");
    f.write("exports." + name + " = " + name + ";");

    filename = getSchemaSourceFile(namespace,name, "");
    f.save(filename);
}

var hasConstructor = require("lib/misc/factories_factories").hasConstructor;
var getConstructor = require("lib/misc/factories_factories").getConstructor;

/*= private
 *
 * @example:
 *    var dataType =  {
 *       browseName: "ServerStatusDataType",
 *       definition: [
 *           { name "timeout", dataType: "UInt32" }
 *       ]
 *    };
 * @param dataType {Object}
 * @return {*}
 */
function constructSchema(address_space, dataType) {

    var dataTypeName = dataType.browseName.name.toString();
    // remove DataType to get the name of the class
    dataTypeName = dataTypeName.replace(/DataType/, "");

    var schema = {
        id: dataType.binaryEncodingNodeId,
        name: dataTypeName,
        namespace: dataType.nodeId.namespace,
        fields: [
            // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
        ]
    };
    var enumeration = address_space.findDataType("Enumeration");
    assert(enumeration,"Enumeration Type not found: please check your nodeset file");
    var structure = address_space.findDataType("Structure");
    assert(structure,"Structure Type not found: please check your nodeset file");

    // construct the fields
    dataType.definition.forEach(function (pair) {

        var dataTypeId = resolveNodeId(pair.dataType);

        var fieldDataType = address_space.findObject(dataTypeId);

        if (!fieldDataType) {
            throw new Error(" cannot find description for object " + dataTypeId +
                ". Check that this node exists in the nodeset.xml file");
        }

        //xx console.log("xxxxx dataType",dataType.toString());

        // check if  dataType is an enumeration or a structure or  a basic type
        if (fieldDataType.isSupertypeOf(enumeration)) {
            makeEnumeration(fieldDataType);
        }
        if (fieldDataType.isSupertypeOf(structure)) {
            makeStructure(fieldDataType);
        }

        var dataTypeName = fieldDataType.browseName.toString();
        dataTypeName = dataTypeName.replace(/DataType/, "");

        schema.fields.push({
            name: lowerFirstLetter(pair.name),
            fieldType: dataTypeName,
            isArray: false,
            description: (pair.description ? pair.description.text : "")
        });
    });
    return schema;
}
function makeStructure(dataType,bForce) {

    bForce = !!bForce;

    assert(dataType instanceof UADataType);

    var address_space = dataType.__address_space;
    assert(address_space.constructor.name === "AddressSpace");
    assert(address_space instanceof AddressSpace);

    var namespaceUri = address_space.getNamespaceUri(dataType.nodeId.namespace);

    // istanbul ignore next
    if (!dataType.binaryEncodingNodeId) {
        throw new Error("DataType with name " + dataType.browseName.toString() + " has no binaryEncoding node\nplease check your nodeset file");
    }

    // if binaryEncodingNodeId is in the standard factory => no need to overwrite

    if (!bForce && (hasConstructor(dataType.binaryEncodingNodeId) ||   dataType.binaryEncodingNodeId.namespace === 0)) {
        //xx console.log("Skipping standard constructor".bgYellow ," for dataType" ,dataType.browseName.toString());
        return getConstructor(dataType.binaryEncodingNodeId);
    }


    var schema = constructSchema(address_space, dataType);


    generateFileCode(namespaceUri,schema);

    generateStructureCode(namespaceUri,schema);

    var filename = getSchemaSourceFile(namespaceUri,schema.name, "");

    var relative_filename = normalize_require_file(__dirname, filename);

    //xx console.log("xxxxxxxxxxxxxxxxxx => ".green,schema.name,filename.cyan,relative_filename.yellow);

    var constructor = require(relative_filename)[schema.name];
    assert(_.isFunction(constructor), "expecting a constructor here");

    return constructor;
}

exports.makeStructure = makeStructure;


var nodeset = {
    ServerState: null,
    ServerStatus: null,
    ServiceCounter: null,
    SessionDiagnostics: null
};
exports.nodeset = nodeset;

function registerDataTypeEnum(address_space, dataTypeName,bForce) {

    var dataType = address_space.findDataType(dataTypeName);
    assert(dataType);
    var superType = address_space.findObject(dataType.subtypeOf);
    assert(superType.browseName.toString() === "Enumeration");
    return makeEnumeration(dataType,bForce);
}

function registerDataType(address_space, dataTypeName, bForce) {

    var dataType = address_space.findDataType(dataTypeName + "DataType");
    if (!dataType) {
        dataType = address_space.findDataType(dataTypeName);
    }
    assert(dataType);
    var superType = address_space.findObject(dataType.subtypeOf);
    assert(superType.browseName.toString() === "Structure");

    // finding object with encoding
    //
    //   <UAObject NodeId="i=864" BrowseName="Default Binary" SymbolicName="DefaultBinary">
    //   <DisplayName>Default Binary</DisplayName>
    //   <References>
    //       <Reference ReferenceType="HasEncoding" IsForward="false">i=862</Reference>
    return makeStructure(dataType,bForce);
}


/**
 * makeServerStatus creates the requested data structure and javascript objects for the OPCUA ServertStatus
 *
 * @param address_space
 */
var makeServerStatus = function (address_space) {

    assert(address_space instanceof AddressSpace);
    var force = true;
   // nodeset.ApplicationDescription = nodeset.ApplicationDescription || registerDataType(address_space, "ApplicationDescription",force);
    nodeset.ServerState = nodeset.ServerState || registerDataTypeEnum(address_space, "ServerState", force);
    nodeset.ServerStatus = nodeset.ServerStatus || registerDataType(address_space, "ServerStatus", force);
    nodeset.ServiceCounter = nodeset.ServiceCounter || registerDataType(address_space, "ServiceCounter", force);
    nodeset.SessionDiagnostics = nodeset.SessionDiagnostics || registerDataType(address_space, "SessionDiagnostics",force);
};

exports.makeServerStatus = makeServerStatus;
