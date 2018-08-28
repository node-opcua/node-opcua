"use strict";
const async = require("async");
const opcua = require("node-opcua-client");
const assert = require("assert");
const parseBinaryXSD = require("node-opcua-generator").parseBinaryXSD;


const doDebug = false;

function parse_opcua_common(session,callback)  {

    const binaries = "i=83";

    let binSchemaReferences = [];
    let xmlSchemaReferences = [];

    async.series([

        function browse_all_opc_binary_schema_and_xml_schema(callback) {
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
            session.browse(browseDescriptions, function (err, browseResults) {
                if (err) {
                    return callback(err);
                }

                binSchemaReferences = browseResults[0].references;
                xmlSchemaReferences = browseResults[1].references;

                callback(err);
            });
        },

        function for_all_binary_schemas(callback) {

            async.eachLimit(binSchemaReferences, 1, function (reference, callback) {

                const nodeId = reference.nodeId;

                if (doDebug) {
                    console.log("nodeId".cyan, nodeId.toString(), "browseName ", reference.browseName.toString());
                }

                let strTypeDictionary;
                async.series([

                    function read_type_definition_xsd_value(callback) {

                        session.read({
                            nodeId: nodeId,
                            attributeId: opcua.AttributeIds.Value
                        }, function (err, dataValue) {
                            if (err) {
                                return callback(err);
                            }
                            // console.log(dataValue.toString());
                            assert(dataValue.value.dataType === opcua.DataType.ByteString);
                            strTypeDictionary = dataValue.value.value.toString("ascii");

                            // console.log(strTypeDictionary.yellow);
                            parseBinaryXSD(strTypeDictionary,function(err,data){
                                if (err) { return callback(err); }


                                callback(err);
                            });
                        });
                    },
                    function read_namespaceUri(callback) {
                        const browseDescription = {
                            nodeId: nodeId,
                            referenceTypeId: "HasProperty",
                            browseDirection: opcua.BrowseDirection.Forward,
                            resultMask: 0x3F
                        };
                        session.browse(browseDescription, function (err, browseResult) {
                            if (err) {
                                return callback(err);
                            }
                            const nodeId = browseResult.references[0].nodeId;
                            session.read({ nodeId: nodeId, attributeId: 13},function(err,dataValue){
                                console.log("namespaceUri =",dataValue.value.value.toString());
                                const namespaceUri = dataValue.value.value.toString();
                                callback();
                            });
                        });

                    },
                    function enumerate_all_type_with_id(callback) {

                        const browseDescription = {
                            nodeId: nodeId,
                            referenceTypeId: "HasComponent",
                            browseDirection: opcua.BrowseDirection.Forward,
                            resultMask: 0x3F
                        };
                        session.browse(browseDescription, function (err, browseResult) {

                            if (err) {
                                return callback(err);
                            }
                            console.log(browseResult.constructor.name);

                            assert(browseResult.constructor.name === "BrowseResult");

                            console.log("--" ,browseResult.toString());

                            if (doDebug) {
                                browseResult.references = browseResult.references || [];
                                const aa =  browseResult.references.map(function (x) {
                                    return x.nodeId.toString() + " " + x.browseName;
                                }).join("|  \n");
                                console.log("r =",aa);
                            }


                            async.each(browseResult.references,

                              function process_structure(x, callback) {
                                  const nodeId = x.nodeId;
                                  const name = x.browseName.toString();
                                  const browseDescription = {
                                      nodeId: nodeId,
                                      referenceTypeId: "HasDescription",
                                      browseDirection: opcua.BrowseDirection.Inverse,
                                      resultMask: 0x3F
                                  };
                                  // find DescriptionOf reference which will be the id for ExtensionObjects....
                                  session.browse(browseDescription, function (err, browseResult) {
                                      if (err) {
                                          return callback(err);
                                      }
                                      const nnn = browseResult.references[0].nodeId;
                                      console.log(" ", nodeId.toString(), name, "nn=", nnn.toString());
                                      callback();
                                  });
                              }, callback);
                        });
                    }
                ], callback);
            }, callback);
        },
        function (callback) {
            callback();
        }

    ], function (err) {
        callback(err);
    });

}
exports.parse_opcua_common = parse_opcua_common;
