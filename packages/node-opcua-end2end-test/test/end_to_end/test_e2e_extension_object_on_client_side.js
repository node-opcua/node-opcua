"use strict";
const os = require("os");
const fs = require("fs");
const path = require("path");

const opcua = require("node-opcua");
const async = require("async");
const should = require("should");

const { start_simple_server, stop_simple_server } = require("../../test_helpers/external_server_fixture");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");

const AttributeIds = opcua.AttributeIds;
const StatusCodes = opcua.StatusCodes;
const OPCUAClient = opcua.OPCUAClient;

const port = 2018;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing extension object with client residing on a different process than the server process", function () {
    this.timeout(Math.max(600000, this.timeout()));

    let serverHandle = null;

    const options = {
        silent: true,
        server_sourcefile: path.join(__dirname, "../../test_helpers/bin/simple_server_with_custom_extension_objects.js"),
        port
    };
    fs.existsSync(options.server_sourcefile).should.eql(true, "cannot find simple_server_with_custom_extension_objects script");

    before(async () => {
        serverHandle = await start_simple_server(options);
    });
    after(async () => {
        await stop_simple_server(serverHandle);
    });

    it("should read the MyStructureDataType definition", function (done) {
        const client = OPCUAClient.create({
            endpointMustExist: false
        });
        const endpointUrl = serverHandle.endpointUrl;

        const nodeId = "ns=2;i=6001";
        perform_operation_on_client_session(
            client,
            endpointUrl,
            function (session, inner_done) {
                async.series(
                    [
                        function (callback) {
                            const nodesToRead = [new opcua.ReadValueId({ nodeId: nodeId, attributeId: AttributeIds.Value })];

                            session.read(nodesToRead, function (err, dataValues) {
                                should.not.exist(err);
                                dataValues.length.should.eql(1);
                                //xx console.log("dataValue =", dataValues[0]);

                                if (!err) {
                                    dataValues[0].statusCode.should.eql(StatusCodes.Good);

                                    //xx console.log(" input,",nodesToRead[0].toString());
                                    //xx console.log(" result,",results[0].toString());
                                    const xmlData = dataValues[0].value.value.toString("ascii");
                                    xmlData.should.match(
                                        /opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/
                                    );
                                }
                                callback(err);
                            });
                        },

                        function (callback) {
                            const nodeToRead = {
                                nodeId: nodeId,
                                attributeId: 13,
                                indexRange: new opcua.NumericRange() // "0:16777235"
                            };
                            session.read(nodeToRead, function (err, dataValue) {
                                if (!err) {
                                    //xx console.log(" input,",nodesToRead[0].toString());
                                    //xx console.log(" result,",results[0].toString());
                                    const xmlData = dataValue.value.value.toString("ascii");
                                    xmlData.should.match(
                                        /opc:StructuredType BaseType="ua:ExtensionObject" Name="MyStructureDataType"/
                                    );
                                }
                                callback(err);
                            });
                        }
                    ],
                    inner_done
                );
            },
            done
        );
    });
});
