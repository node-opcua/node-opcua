"use strict";

const should = require("should");
const fs = require("fs");
const async = require("async");

const AddressSpace = require("../..").AddressSpace;
const SessionContext = require("../..").SessionContext;
const context = SessionContext.defaultContext;

const generate_address_space = require("../..").generate_address_space;

const nodesets = require("node-opcua-nodesets");
const WriteValue = require("node-opcua-service-write").WriteValue;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const DataType = require("node-opcua-variant").DataType;
const StatusCodes = require("node-opcua-status-code").StatusCodes;
const historizing_service = require("node-opcua-service-history");
require("date-utils");

function date_add(date, options) {
    const tmp = new Date(date);

    tmp.add(options);
    return tmp;
}

// make sure extra error checking is made on object constructions
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node", function () {

    let addressSpace;

    before(function (done) {

        addressSpace = new AddressSpace();
        const xml_files = [
            nodesets.standard_nodeset_file
        ];
        fs.existsSync(xml_files[0]).should.be.eql(true, "file " + xml_files[0] + " must exist");
        generate_address_space(addressSpace, xml_files, function (err) {

            const namespace = addressSpace.registerNamespace("MyPrivateNamespace");
            namespace.namespaceUri.should.eql("MyPrivateNamespace");

            done(err);
        });

    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });

    it("HHH3- should keep values up to options.maxOnlineValues to provide historical reads", function (done) {

        const node = addressSpace.getOwnNamespace().addVariable({
            browseName: "MyVar2",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 3 // Only very few values !!!!
        });
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's injects some values into the history
        const today = new Date();

        const historyReadDetails = new historizing_service.ReadRawModifiedDetails({
            isReadModified: false,
            startTime: date_add(today, { seconds: -10 }),
            endTime: date_add(today, { seconds: 10 }),
            numValuesPerNode: 1000,
            returnBounds: true
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint = null;

        async.series([

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, { seconds: 0 }));

                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    if (err) {
                        return callback(err);
                    }

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(1);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, { seconds: 0 }));
                    callback();
                });
            },

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, { seconds: 1 }));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));
                callback();
            },

            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    if (err) {
                        return callback(err);
                    }

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(2);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, { seconds: 0 }));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, { seconds: 1 }));
                    callback();
                });
            },


            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, { seconds: 2 }));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 0 }));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    if (err) {
                        return callback(err);
                    }

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, { seconds: 0 }));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, { seconds: 1 }));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, { seconds: 2 }));
                    callback();
                });
            },


            // the queue is full, the next insertion will cause the queue to be trimmed

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, { seconds: 3 }));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 1 }));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    if (err) {
                        return callback(err);
                    }

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, { seconds: 1 }));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, { seconds: 2 }));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, { seconds: 3 }));
                    callback();
                });
            },

            // the queue is (still)  full, the next insertion will cause the queue to be trimmed, again

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, { seconds: 4 }));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, { seconds: 2 }));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    if (err) {
                        return callback(err);
                    }

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, { seconds: 2 }));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, { seconds: 3 }));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, { seconds: 4 }));
                    callback();
                });
            }
        ], done);

    });

});