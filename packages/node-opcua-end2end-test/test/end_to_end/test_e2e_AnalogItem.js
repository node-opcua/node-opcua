"use strict";
const chalk = require("chalk");
const should = require("should");
const async = require("async");
const _ = require("underscore");

const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const StatusCodes = opcua.StatusCodes;
const DataType = opcua.DataType;
const AttributeIds = opcua.AttributeIds;
const BrowseDirection = opcua.BrowseDirection;
const readUAAnalogItem = opcua.readUAAnalogItem;

const debugLog = require("node-opcua-debug").make_debugLog(__filename);

const port = 2000;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("testing AnalogItem on client side", function() {

    let server, client, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(600000, this.timeout()));

    let g_session = null;
    before(function(done) {

        server = build_server_with_temperature_device({ port: port }, function(err) {
            if (err) return done(err);
            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            temperatureVariableId = server.temperatureVariableId;
            done(err);
        });
    });

    beforeEach(function(done) {
        client = OPCUAClient.create();
        async.series([
            function(callback) {
                client.connect(endpointUrl, callback);
            },
            function(callback) {
                debugLog(" createSession");
                client.createSession(function(err, session) {
                    g_session = session;
                    debugLog(chalk.yellow.bold(" Error ="), err);
                    callback(err);
                });
            }
        ], done);
    });

    afterEach(function(done) {
        async.series([
            function(callback) {
                debugLog("closing session");
                if (g_session) {
                    g_session.close(callback);
                    g_session = null;
                } else {
                    callback(null);
                }
            },
            function(callback) {
                client.disconnect(callback);
            }
        ], done);
    });

    after(function(done) {
        server.shutdown(done);
    });


    it("readUAAnalogItem should extract all properties of a UAAnalogItem ", function(done) {


        const nodeId = "ns=1;s=TemperatureAnalogItem";

        readUAAnalogItem(g_session, nodeId, function(err, data) {

            if (err) { return done(err); }

            data.should.have.ownProperty("engineeringUnits");
            data.should.have.ownProperty("engineeringUnitsRange");
            data.should.have.ownProperty("instrumentRange");
            data.should.have.ownProperty("valuePrecision");
            data.should.have.ownProperty("definition");

            done();

        });

    });
    it("readUAAnalogItem should return an error if not doesn't exist", function(done) {
        const nodeId = "ns=4;s=invalidnode";
        readUAAnalogItem(g_session, nodeId, function(err, data) {
            should.exist(err);
            done();
        });

    });

    /**
     * find the nodeId that matches  property  named 'browseName' on a given node
     * @param nodeId
     * @param browseName
     * @param callback
     */
    function findProperty(g_session, nodeId, browseName, callback) {

        const browseDescription = {
            nodeId: nodeId,
            referenceTypeId: "HasProperty",
            browseDirection: BrowseDirection.Forward,
            resultMask: 0x3F
        };
        g_session.browse(browseDescription, function(err, result) {

            if (err) { return callback(err); }


            if (result.statusCode !== StatusCodes.Good) {
                return callback(null, null);
            }

            let tmp = _.filter(result.references, function(e) {
                return e.browseName.name === browseName;
            });
            tmp = tmp.map(function(e) {
                return e.nodeId;
            });
            const found = (tmp.length === 1) ? tmp[0] : null;
            callback(null, found);

        });
    }


    it("should read the EURange property of an analog item", function(done) {

        const nodeId = "ns=1;s=TemperatureAnalogItem";

        findProperty(g_session, nodeId, "EURange", function(err, propertyId) {

            if (err) {
                return done(err);
            }

            should.exist(propertyId);

            const nodeToRead = {
                nodeId: propertyId,
                attributeId: AttributeIds.Value
            };
            //xx console.log("propertyId = ", propertyId.toString());
            g_session.read(nodeToRead, function(err, dataValue) {
                if (err) {
                    return done(err);
                }

                //xx console.log("result = ",result.toString());
                dataValue.value.dataType.should.eql(DataType.ExtensionObject);

                dataValue.value.value.low.should.eql(100);
                dataValue.value.value.high.should.eql(200);

                done(err);
            });
        });

    });
});




