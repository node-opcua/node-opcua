"use strict";
const async = require("async");
const opcua = require("node-opcua-client");
const assert = require("assert");
const { parseBinaryXSD }= require("node-opcua-schemas");
const chalk = require("chalk");
const { promisify } = require("util");
const doDebug = false;

const parseBinaryXSD2 = promisify(parseBinaryXSD);

async function parse_opcua_common(session) {

    const binaries = "i=83";

    // browse_all_opc_binary_schema_and_xml_schema
    const browseDescriptions = [
        {
            nodeId: "i=93", //OPCBinarySchema_TypeSystem
            referenceTypeId: "HasComponent",
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3F
        },
        {
            nodeId: "i=92", //XMLSchema_TypeSystem
            referenceTypeId: "HasComponent",
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3F
        }

    ];

    const browseResults = await session.browse(browseDescriptions);

    const binSchemaReferences = browseResults[0].references;
    const xmlSchemaReferences = browseResults[1].references;

    
    for (const reference of binSchemaReferences) {

        const nodeId = reference.nodeId;

        if (doDebug) {
            console.log(chalk.cyan("nodeId"), nodeId.toString(), "browseName ", reference.browseName.toString());
        }

        // read_type_definition_xsd_value
        const dataValue = await session.read({
            nodeId: nodeId,
            attributeId: opcua.AttributeIds.Value
        });
    
        // console.log(dataValue.toString());
        assert(dataValue.value.dataType === opcua.DataType.ByteString);
        const strTypeDictionary = dataValue.value.value.toString("ascii");

        await parseBinaryXSD2(strTypeDictionary, []);

        // ead_namespaceUri(callback) {
        const browseDescription = {
            nodeId: nodeId,
            referenceTypeId: "HasProperty",
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3F
        };
        const browseResult = await session.browse(browseDescription);

        const nodeId2 = browseResult.references[0].nodeId;
        const dataValue2 = await session.read({
            nodeId: nodeId2,
            attributeId: 13
        });
        if (doDebug) {
            console.log("namespaceUri =", dataValue2.value.value.toString());
        }
        const namespaceUri = dataValue2.value.value.toString();

        // function enumerate_all_type_with_id(callback) {
        const browseDescription2 = {
            nodeId: nodeId2,
            referenceTypeId: "HasComponent",
            browseDirection: opcua.BrowseDirection.Forward,
            resultMask: 0x3F
        };
        const browseResult2 = await session.browse(browseDescription2);
        if (doDebug) {
            console.log("--", browseResult2.toString());
        }
        if (doDebug) {
            browseResult2.references = browseResult2.references || [];
            const aa = browseResult2.references.map( (x) => x.nodeId.toString() + " " + x.browseName).join("|  \n");
            console.log("r =", aa);
        }

        for (const x of browseResult2.references) {
            // process_structure(x, callback) {
            const nodeId = x.nodeId;
            const name = x.browseName.toString();
            const browseDescription = {
                nodeId: nodeId,
                referenceTypeId: "HasDescription",
                browseDirection: opcua.BrowseDirection.Inverse,
                resultMask: 0x3F
            };
            // find DescriptionOf reference which will be the id for ExtensionObjects....
            const browseResult = await session.browse(browseDescription);
            const nnn = browseResult.references[0].nodeId;
            if (doDebug) {
                console.log(" ", nodeId.toString(), name, "nn=", nnn.toString());
            }
        }
    }
}

exports.parse_opcua_common = parse_opcua_common;
