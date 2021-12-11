"use strict";
const chalk = require("chalk");
const should = require("should");
const async = require("async");

const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const StatusCodes = opcua.StatusCodes;
const DataType = opcua.DataType;
const AttributeIds = opcua.AttributeIds;
const BrowseDirection = opcua.BrowseDirection;
const readUAAnalogItem = opcua.readUAAnalogItem;

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 2009;

const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing AnalogItem on client side", function () {
    let server, client, temperatureVariableId, endpointUrl;

    this.timeout(Math.max(600000, this.timeout()));

    let g_session = null;
    before(async () => {
        server = await build_server_with_temperature_device({ port });
        endpointUrl = server.getEndpointUrl();
        temperatureVariableId = server.temperatureVariableId;
    });

    beforeEach(async () => {
        client = OPCUAClient.create();
        await client.connect(endpointUrl);
        g_session = await client.createSession();
    });

    afterEach(async () => {
        if (g_session) {
            await g_session.close();
            g_session = null;
        }
        await client.disconnect();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("readUAAnalogItem should extract all properties of a UAAnalogItem ", function (done) {
        const nodeId = "ns=1;s=TemperatureAnalogItem";

        readUAAnalogItem(g_session, nodeId, function (err, data) {
            if (err) {
                return done(err);
            }

            data.should.have.ownProperty("engineeringUnits");
            data.should.have.ownProperty("engineeringUnitsRange");
            data.should.have.ownProperty("instrumentRange");
            data.should.have.ownProperty("valuePrecision");
            data.should.have.ownProperty("definition");

            done();
        });
    });
    it("readUAAnalogItem should return an error if not doesn't exist", function (done) {
        const nodeId = "ns=4;s=invalidnode";
        readUAAnalogItem(g_session, nodeId, function (err, data) {
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
            resultMask: 0x3f
        };
        g_session.browse(browseDescription, function (err, result) {
            if (err) {
                return callback(err);
            }

            if (result.statusCode !== StatusCodes.Good) {
                return callback(null, null);
            }

            let tmp = result.references.filter((e) => e.browseName.name === browseName);

            tmp = tmp.map(function (e) {
                return e.nodeId;
            });
            const found = tmp.length === 1 ? tmp[0] : null;
            callback(null, found);
        });
    }

    it("should read the EURange property of an analog item", function (done) {
        const nodeId = "ns=1;s=TemperatureAnalogItem";

        findProperty(g_session, nodeId, "EURange", function (err, propertyId) {
            if (err) {
                return done(err);
            }

            should.exist(propertyId);

            const nodeToRead = {
                nodeId: propertyId,
                attributeId: AttributeIds.Value
            };
            //xx console.log("propertyId = ", propertyId.toString());
            g_session.read(nodeToRead, function (err, dataValue) {
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
