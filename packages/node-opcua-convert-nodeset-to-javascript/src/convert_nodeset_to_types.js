"use strict";

const assert = require("node-opcua-assert");
const _ = require("underscore");

const path = require("path");
const fs = require("fs");

const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;
const AddressSpace = require("node-opcua-address-space").AddressSpace;
const UADataType = require("node-opcua-address-space").UADataType;

const normalize_require_file = require("node-opcua-utils").normalize_require_file;
const LineFile = require("node-opcua-utils/src/linefile").LineFile;
const lowerFirstLetter = require("node-opcua-utils").lowerFirstLetter;

const hasConstructor = require("node-opcua-factory").hasConstructor;
const getConstructor = require("node-opcua-factory").getConstructor;
const hasEnumeration = require("node-opcua-factory").hasEnumeration;
const getEnumeration = require("node-opcua-factory").getEnumeration;

const crypto = require("crypto");

function hashNamespace(namespaceUri) {
    const hash = crypto
        .createHash("sha1")
        .update(namespaceUri)
        .digest("hex");
    return hash;
}

/**
 * returns the location of the  javascript version of the schema  corresponding to schemaName
 * @method getSchemaSourceFile
 * @param namespace {String}
 * @param schemaName {String}
 * @param schema_type {String}  "enum" | "schema"
 * @param schema_folder {String}
 * @return {string}
 * @private
 */
function getSchemaSourceFile(namespace, schemaName, schema_type, schema_folder) {
    assert(schemaName.match(/[a-zA-Z]+/));
    if (!fs.existsSync(schema_folder)) {
        throw new Error("Cannot find schema folder  " + schema_folder);
    }
    if (!(schema_type === "enum" || schema_type === "schema" || schema_type === "")) {
        throw new Error(" unexpected schema_type" + schema_type);
    }
    const subfolder = hashNamespace(namespace);

    const root = path.join(schema_folder, "schemas");
    const folder = path.normalize(path.join(root, subfolder));

    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
    }
    if (schema_type === "") {
        return path.join(folder, schemaName + ".js");
    } else {
        return path.join(folder, schemaName + "_" + schema_type + ".js");
    }
}

/**
 * convert a nodeset enumeration into a javascript script enumeration code
 * @method generateEnumerationCode
 * @param dataType
 * @param filename {string} the output filename
 *
 */
function generateEnumerationCode(dataType, filename) {
    assert(typeof filename === "string");

    const dataTypeName = dataType.browseName.name.toString();
    assert(!hasEnumeration(dataTypeName));

    // create the enumeration file
    const f = new LineFile();
    f.write("// namespace " + dataType.namespaceUri.toString());
    f.write('const factories  = require("node-opcua-factory");');
    f.write('const makeNodeId = require("node-opcua-nodeid").makeNodeId;');

    f.write("const " + dataTypeName + "_Schema = {");
    f.write("  id:  makeNodeId(" + dataType.nodeId.value + "," + dataType.nodeId.namespace + "),");
    f.write("  name: '" + dataTypeName + "',");
    f.write("  namespace: '" + dataType.nodeId.namespace + "',");

    f.write("  enumValues: {");
    dataType.definition.forEach(function(pair) {
        f.write("     " + pair.name + ": " + pair.value + ",");
    });
    f.write("  }");
    f.write("};");
    f.write("exports." + dataTypeName + "_Schema = " + dataTypeName + "_Schema;");
    f.write("exports." + dataTypeName + " = factories.registerEnumeration(" + dataTypeName + "_Schema);");
    f.save(filename);
}

const QualifiedName = require("node-opcua-data-model").QualifiedName;
/**
 * const dataType = {
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
function makeEnumeration(dataType, bForce) {
    assert(dataType);
    assert(dataType.hasOwnProperty("browseName"));
    assert(dataType.browseName instanceof QualifiedName);
    assert(_.isArray(dataType.definition));

    const dataTypeName = dataType.browseName.name.toString();
    if (hasEnumeration(dataTypeName)) {
        return getEnumeration(dataTypeName).typedEnum;
    }
    //const Enumeration_Schema = {
    //    id: dataType.nodeId,
    //    name: dataType.browseName.toString(),
    //    enumValues: {}
    //};
    //
    //dataType.definition.forEach(function (pair) {
    //    Enumeration_Schema.enumValues[pair.name] = parseInt(pair.value, 10);
    //});

    const namespace = dataType.namespaceUri;
    const filename = getSchemaSourceFile(namespace, dataType.browseName.toString(), "enum");

    generateEnumerationCode(dataType, filename);

    const relative_filename = normalize_require_file(__dirname, filename);

    return require(relative_filename)[dataType.browseName.toString()];
}

exports.makeEnumeration = makeEnumeration;

function generateStructureCode(namespace, schema, schema_folder) {
    assert(fs.existsSync(schema_folder, "schema folder must exist"));
    const name = schema.name;

    const f = new LineFile();

    f.write('const factories  = require("node-opcua-factory");');
    f.write('const coerceNodeId = require("node-opcua-nodeid").coerceNodeId;');
    f.write("const " + schema.name + "_Schema = {");
    f.write("    id:  coerceNodeId('" + schema.id.toString() + "'),");
    f.write('    name: "' + name + '",');
    f.write("    fields: [");
    schema.fields.forEach(function(field) {
        f.write("       {");
        f.write('           name: "' + field.name + '",');
        f.write('           fieldType: "' + field.fieldType + '"');
        if (field.isArray) {
            f.write("         ,   isArray:" + (field.isArray ? "true" : false));
        }
        if (field.description) {
            f.write("          , documentation:" + ' "' + field.description + '" ');
        }
        f.write("       },");
    });
    f.write("        ]");
    f.write("    };");
    f.write("exports." + name + "_Schema = " + name + "_Schema;");
    //xx write("exports."+name+" = factories.registerObject(" + name+"_Schema);");

    const filename = getSchemaSourceFile(namespace, name, "schema", schema_folder);
    f.save(filename);
}

function generateFileCode(namespace, schema, schema_folder) {
    assert(fs.existsSync(schema_folder, "schema folder must exist"));
    assert(typeof namespace === "string");

    const f = new LineFile();

    const name = schema.name;
    const hint = "$node-opcua/schemas/" + hashNamespace(namespace);

    f.write("// namespace " + namespace.toString());
    f.write('const  registerObject = require("node-opcua-factory").registerObject;');
    // f.write("registerObject('_generated_schemas|"+ name + "','_generated_schemas');");
    f.write("registerObject('" + hint + "|" + name + "');");

    //
    f.write('require("' + hint + "/" + name + '_schema");');

    // const filename = "../_generated_schemas/_auto_generated_"+ name;
    let filename = "$node-opcua/generated/_auto_generated_" + name;
    f.write("const " + name + ' = require("' + filename + '").' + name + ";");
    f.write("exports." + name + " = " + name + ";");

    filename = getSchemaSourceFile(namespace, name, "", schema_folder);
    f.save(filename);
}

function makeStructure(dataType, bForce, schema_folder) {
    assert(fs.existsSync(schema_folder), " schema_folder must exist");

    bForce = !!bForce;

    assert(dataType instanceof UADataType);

    const addressSpace = dataType.addressSpace;
    assert(addressSpace.constructor.name === "AddressSpace");
    assert(addressSpace instanceof AddressSpace);

    const namespaceUri = addressSpace.getNamespaceUri(dataType.nodeId.namespace);

    // istanbul ignore next
    if (!dataType.binaryEncodingNodeId) {
        throw new Error(
            "DataType with name " +
                dataType.browseName.toString() +
                " has no binaryEncoding node\nplease check your nodeset file"
        );
    }

    // if binaryEncodingNodeId is in the standard factory => no need to overwrite

    if (!bForce && (hasConstructor(dataType.binaryEncodingNodeId) || dataType.binaryEncodingNodeId.namespace === 0)) {
        //xx console.log("Skipping standard constructor".bgYellow ," for dataType" ,dataType.browseName.toString());
        return getConstructor(dataType.binaryEncodingNodeId);
    }

    const schema = constructSchema(addressSpace, dataType);

    generateFileCode(namespaceUri, schema, schema_folder);

    generateStructureCode(namespaceUri, schema);

    const filename = getSchemaSourceFile(namespaceUri, schema.name, "");

    const relative_filename = normalize_require_file(__dirname, filename);

    //xx console.log("xxxxxxxxxxxxxxxxxx => ".green,schema.name,filename.cyan,relative_filename.yellow);

    const constructor = require(relative_filename)[schema.name];
    assert(_.isFunction(constructor), "expecting a constructor here");

    return constructor;
}

exports.makeStructure = makeStructure;

/*= private
 *
 * @example:
 * @example:
 *    const dataType =  {
 *       browseName: "ServerStatusDataType",
 *       definition: [
 *           { name "timeout", dataType: "UInt32" }
 *       ]
 *    };
 * @param dataType {Object}
 * @return {*}
 */
function constructSchema(addressSpace, dataType) {
    let dataTypeName = dataType.browseName.name.toString();
    // remove DataType to get the name of the class
    dataTypeName = dataTypeName.replace(/DataType/, "");

    const schema = {
        id: dataType.binaryEncodingNodeId,
        name: dataTypeName,
        namespace: dataType.nodeId.namespace,
        fields: [
            // { name: "title", fieldType: "UAString" , isArray: false , documentation: "some text"},
        ]
    };
    const enumeration = addressSpace.findDataType("Enumeration");
    assert(enumeration, "Enumeration Type not found: please check your nodeset file");
    const structure = addressSpace.findDataType("Structure");
    assert(structure, "Structure Type not found: please check your nodeset file");

    // construct the fields
    dataType.definition.forEach(function(pair) {
        const dataTypeId = resolveNodeId(pair.dataType);

        const fieldDataType = addressSpace.findNode(dataTypeId);

        if (!fieldDataType) {
            throw new Error(
                " cannot find description for object " +
                    dataTypeId +
                    ". Check that this node exists in the nodeset.xml file"
            );
        }

        //xx console.log("xxxxx dataType",dataType.toString());

        // check if  dataType is an enumeration or a structure or  a basic type
        if (fieldDataType.isSupertypeOf(enumeration)) {
            makeEnumeration(fieldDataType);
        }
        if (fieldDataType.isSupertypeOf(structure)) {
            makeStructure(fieldDataType);
        }

        let dataTypeName = fieldDataType.browseName.toString();
        dataTypeName = dataTypeName.replace(/DataType/, "");

        schema.fields.push({
            name: lowerFirstLetter(pair.name),
            fieldType: dataTypeName,
            isArray: false,
            description: pair.description ? pair.description.text : ""
        });
    });
    return schema;
}

const nodeset = {
    ServerState: null,
    ServerStatus: null,
    ServiceCounter: null,
    SessionDiagnostics: null
};
exports.nodeset = nodeset;

function registerDataTypeEnum(addressSpace, dataTypeName, bForce) {
    const dataType = addressSpace.findDataType(dataTypeName);
    assert(dataType);
    const superType = addressSpace.findNode(dataType.subtypeOf);
    assert(superType.browseName.toString() === "Enumeration");
    return makeEnumeration(dataType, bForce);
}

function registerDataType(addressSpace, dataTypeName, schema_folder, bForce) {
    if (!fs.existsSync(schema_folder)) {
        throw new Error("schema_folder must exist : " + dataTypeName + " " + schema_folder);
    }
    let dataType = addressSpace.findDataType(dataTypeName + "DataType");
    if (!dataType) {
        dataType = addressSpace.findDataType(dataTypeName);
    }

    // istanbul ignore next
    if (!dataType) {
        console.log("registerDataType: warning : Cannot find DataType " + dataTypeName);
        return null;
        //xx throw new Error(" Cannot find DataType " + dataTypeName);
    }

    const superType = addressSpace.findNode(dataType.subtypeOf);
    assert(superType.browseName.toString() === "Structure");

    // finding object with encoding
    //
    //   <UAObject NodeId="i=864" BrowseName="Default Binary" SymbolicName="DefaultBinary">
    //   <DisplayName>Default Binary</DisplayName>
    //   <References>
    //       <Reference ReferenceType="HasEncoding" IsForward="false">i=862</Reference>
    return makeStructure(dataType, bForce, schema_folder);
}

/**
 * creates the requested data structure and javascript objects for the OPCUA objects
 * @method createExtensionObjectDefinition
 * @param addressSpace {AddressSpace}
 */
const createExtensionObjectDefinition = function(addressSpace) {
    assert(addressSpace instanceof AddressSpace);
    const force = true;
    // nodeset.ApplicationDescription = nodeset.ApplicationDescription || registerDataType(addressSpace, "ApplicationDescription",force);
    nodeset.ServerState = nodeset.ServerState || registerDataTypeEnum(addressSpace, "ServerState", force);
    nodeset.ServerStatus = nodeset.ServerStatus || registerDataType(addressSpace, "ServerStatus", force);
    //xx nodeset.ServiceCounter = nodeset.ServiceCounter || registerDataType(addressSpace, "ServiceCounter", force);
    //xx nodeset.SessionDiagnostics = nodeset.SessionDiagnostics || registerDataType(addressSpace, "SessionDiagnostics",force);
    //xx nodeset.ServerDiagnosticsSummary = nodeset.ServerDiagnosticsSummary || registerDataType(addressSpace, "ServerDiagnosticsSummary",force);
    //xx nodeset.SubscriptionDiagnostics = nodeset.SubscriptionDiagnostics || registerDataType(addressSpace,"SubscriptionDiagnostics",force);
    //xx nodeset.ModelChangeStructure = nodeset.ModelChangeStructure || registerDataType(addressSpace,"ModelChangeStructure",force);
    //xx nodeset.SemanticChangeStructure = nodeset.SemanticChangeStructure || registerDataType(addressSpace,"SemanticChangeStructure",force);
    //xx nodeset.RedundantServer = nodeset.RedundantServer || registerDataType(addressSpace,"RedundantServer",force);
    //xx nodeset.SamplingIntervalDiagnostics = nodeset.SamplingIntervalDiagnostics || registerDataType(addressSpace,"SamplingIntervalDiagnostics",force);
    //xx nodeset.SessionSecurityDiagnostics = nodeset.SessionSecurityDiagnostics || registerDataType(addressSpace,"SessionSecurityDiagnostics",force);

    /*
     *  This Structured DataType defines the local time that may or may not take daylight saving time
     *  into account. Its elements are described in Table 24.
     *  Table 24 – TimeZoneDataType Definition
     *  Name                       Type       Description
     *  TimeZoneDataType structure
     *  offset                     Int16     The offset in minutes from UtcTime
     *  daylightSavingInOffset     Boolean   If TRUE, then daylight saving time (DST) is in effect and offset
     *                                       includes the DST correction. If FALSE then the offset does not
     *                                       include the DST correction and DST may or may not have
     *                                       been in effect.
     */
    //xx nodeset.TimeZoneDataType = nodeset.TimeZoneDataType || registerDataType(addressSpace, "TimeZoneDataType", force);
};

exports.createExtensionObjectDefinition = createExtensionObjectDefinition;
