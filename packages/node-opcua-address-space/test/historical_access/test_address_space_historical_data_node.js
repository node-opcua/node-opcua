"use strict";

const should = require("should");
const fs = require("fs");
const async = require("async");

var StatusCodes = require("node-opcua-status-code").StatusCodes;

const AddressSpace = require("../..").AddressSpace;
const SessionContext = require("../..").SessionContext;
const context = SessionContext.defaultContext;

const generate_address_space = require("../..").generate_address_space;

const nodesets = require("node-opcua-nodesets");
const WriteValue = require("node-opcua-service-write").WriteValue;
const AttributeIds = require("node-opcua-data-model").AttributeIds;
const DataType = require("node-opcua-variant").DataType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
const historizing_service = require("node-opcua-service-history");
require("date-utils");

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
            done(err);
        });

    });
    after(function () {
        if (addressSpace) {
            addressSpace.dispose();
            addressSpace = null;
        }
    });

    it("should create a 'HA Configuration' node", function () {

        const node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node);
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");
    });

    function date_add(date, options) {
        const tmp = new Date(date);

        tmp.add(options);
        return tmp;
    }

    it("should keep values in memory to provide historical reads", function (done) {

        const node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node);
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's injects some values into the history
        const today = new Date();

        node.setValueFromSource({dataType: "Double", value: 0}, StatusCodes.Good, date_add(today, {seconds: 0}));
        node.setValueFromSource({dataType: "Double", value: 1}, StatusCodes.Good, date_add(today, {seconds: 1}));
        node.setValueFromSource({dataType: "Double", value: 2}, StatusCodes.Good, date_add(today, {seconds: 2}));
        node.setValueFromSource({dataType: "Double", value: 3}, StatusCodes.Good, date_add(today, {seconds: 3}));
        node.setValueFromSource({dataType: "Double", value: 4}, StatusCodes.Good, date_add(today, {seconds: 4}));
        node.setValueFromSource({dataType: "Double", value: 5}, StatusCodes.Good, date_add(today, {seconds: 5}));
        node.setValueFromSource({dataType: "Double", value: 6}, StatusCodes.Good, date_add(today, {seconds: 6}));

        node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(today);


        const historyReadDetails = new historizing_service.ReadRawModifiedDetails({
            isReadModified: false,
            startTime: date_add(today, {seconds: -10}),
            endTime: date_add(today, {seconds: 10}),
            numValuesPerNode: 1000,
            returnBounds: true
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint = null;


        node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

            should.not.exist(historyReadResult.continuationPoint);
            historyReadResult.statusCode.should.eql(StatusCodes.Good);
            const dataValues = historyReadResult.historyData.dataValues;
            //xx console.log(dataValues);
            dataValues.length.should.eql(7);
            dataValues[0].value.value.should.eql(0);
            dataValues[1].value.value.should.eql(1);
            dataValues[2].value.value.should.eql(2);
            dataValues[3].value.value.should.eql(3);
            dataValues[4].value.value.should.eql(4);
            dataValues[5].value.value.should.eql(5);
            //xx console.log(historyReadResult.toString());
            done(err);
        });

    });


    it("should keep values up to options.maxOnlineValues to provide historical reads", function (done) {

        const node = addressSpace.addVariable({
            browseName: "MyVar",
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
            startTime: date_add(today, {seconds: -10}),
            endTime: date_add(today, {seconds: 10}),
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
                }, StatusCodes.Good, date_add(today, {seconds: 0}));

                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, {seconds: 0}));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(1);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 0}));
                    callback();
                });
            },

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, {seconds: 1}));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, {seconds: 0}));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(2);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 0}));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 1}));
                    callback();
                });
            },


            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, {seconds: 2}));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, {seconds: 0}));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 0}));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 1}));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, {seconds: 2}));
                    callback();
                });
            },


            // the queue is full, the next insertion will cause the queue to be trimmed

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, {seconds: 3}));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, {seconds: 1}));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 1}));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 2}));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, {seconds: 3}));
                    callback();
                });
            },

            // the queue is (still)  full, the next insertion will cause the queue to be trimmed, again

            function (callback) {
                node.setValueFromSource({
                    dataType: "Double",
                    value: 0
                }, StatusCodes.Good, date_add(today, {seconds: 4}));
                node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(date_add(today, {seconds: 2}));
                callback();
            },
            function (callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 2}));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 3}));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, {seconds: 4}));
                    callback();
                });
            },
        ], done);

    });
    it("should store initial dataValue when historical stuff is set", function (done) {

        const node = addressSpace.addVariable({
            browseName: "MyVar42",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        // let's injects some values into the history
        const today = new Date();

        const historyReadDetails = new historizing_service.ReadRawModifiedDetails({
            isReadModified: false,
            startTime: date_add(today, {seconds: -10}),
            endTime: date_add(today, {seconds: 10}),
            numValuesPerNode: 1000,
            returnBounds: true
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint = null;


        node.setValueFromSource({dataType: "Double", value: 3.14});

        // install historical support after value has been set
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 3 // Only very few values !!!!
        });

        async.series([
            function read_history1(callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(1);
                    dataValues[0].value.value.should.eql(3.14);
                    callback();
                });
            },
            function (callback) {
                // wait a little bit to make sure that sourceTimestamp will change !
                setTimeout(function() {
                    node.setValueFromSource({dataType: "Double", value: 6.28});
                    callback();
                },10);
            },
            function read_history2(callback) {
                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {
                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(2);
                    dataValues[0].value.value.should.eql(3.14);
                    dataValues[1].value.value.should.eql(6.28);
                    callback();
                });
            },
        ], done);

    });

    it("#420 should be possible to set/unset historizing attribute ",function(done){

        // unseting the historizing flag shall suspend value being collected

        const node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 10 // Only very few values !!!!
        });
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        const today = new Date();

        node.setValueFromSource({dataType: "Double", value: 0}, StatusCodes.Good, date_add(today, {seconds: 0}));

        async.series([

            function turn_historizing_attribrute_to_false(callback) {
                const v = new WriteValue({
                    attributeId: AttributeIds.Historizing,
                    value: {value: {dataType: DataType.Boolean, value: false}}
                });
                node.writeAttribute(context, v, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    node.historizing.should.eql(false);
                    callback(err);
                });
            },
            function  lets_inject_some_values(callback) {
                node.setValueFromSource({dataType: "Double", value: 1}, StatusCodes.Good, date_add(today, {seconds: 1}));
                node.setValueFromSource({dataType: "Double", value: 2}, StatusCodes.Good, date_add(today, {seconds: 2}));
                node.setValueFromSource({dataType: "Double", value: 3}, StatusCodes.Good, date_add(today, {seconds: 3}));
                setImmediate(callback);

            },
            function turn_historizing_attribrute_to_true(callback) {
                const v = new WriteValue({
                    attributeId: AttributeIds.Historizing,
                    value: {value: {dataType: DataType.Boolean, value: true}}
                });
                node.writeAttribute(context, v, function (err, statusCode) {
                    statusCode.should.eql(StatusCodes.Good);
                    node.historizing.should.eql(true);
                    callback(err);
                });
            },
            function  lets_inject_some_more_values(callback) {
                node.setValueFromSource({dataType: "Double", value: 4}, StatusCodes.Good, date_add(today, {seconds: 4}));
                node.setValueFromSource({dataType: "Double", value: 5}, StatusCodes.Good, date_add(today, {seconds: 5}));
                node.setValueFromSource({dataType: "Double", value: 6}, StatusCodes.Good, date_add(today, {seconds: 6}));
                setImmediate(callback);
            },

            function (callback) {

                const historyReadDetails = new historizing_service.ReadRawModifiedDetails({
                    isReadModified: false,
                    startTime: date_add(today, {seconds: -10}),
                    endTime: date_add(today, {seconds: 10}),
                    numValuesPerNode: 1000,
                    returnBounds: true
                });
                const indexRange = null;
                const dataEncoding = null;
                const continuationPoint = null;


                node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

                    const dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(4);

                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 0}));
                    // no data recorded
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 4}));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, {seconds: 5}));
                    dataValues[3].sourceTimestamp.should.eql(date_add(today, {seconds: 6}));
                    callback();
                });

            }

        ],done);

    });

});