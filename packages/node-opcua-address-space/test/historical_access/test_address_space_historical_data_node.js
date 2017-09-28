"use strict";

var should = require("should");
var fs = require("fs");
var async = require("async");

var StatusCodes = require("node-opcua-status-code").StatusCodes;

var AddressSpace = require("../..").AddressSpace;
var SessionContext = require("../..").SessionContext;
var context = SessionContext.defaultContext;

var generate_address_space = require("../..").generate_address_space;

var nodesets = require("node-opcua-nodesets");

var historizing_service = require("node-opcua-service-history");
require("date-utils");

// make sure extra error checking is made on object constructions
var describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing Historical Data Node", function () {

    var addressSpace;

    before(function (done) {

        addressSpace = new AddressSpace();
        var xml_files = [
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

        var node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node);
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");
    });

    function date_add(date, options) {
        var tmp = new Date(date);

        tmp.add(options);
        return tmp;
    }

    it("should keep values in memory to provide historical reads", function (done) {

        var node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node);
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's injects some values into the history
        var today = new Date();

        node.setValueFromSource({dataType: "Double", value: 0}, StatusCodes.Good, date_add(today, {seconds: 0}));
        node.setValueFromSource({dataType: "Double", value: 1}, StatusCodes.Good, date_add(today, {seconds: 1}));
        node.setValueFromSource({dataType: "Double", value: 2}, StatusCodes.Good, date_add(today, {seconds: 2}));
        node.setValueFromSource({dataType: "Double", value: 3}, StatusCodes.Good, date_add(today, {seconds: 3}));
        node.setValueFromSource({dataType: "Double", value: 4}, StatusCodes.Good, date_add(today, {seconds: 4}));
        node.setValueFromSource({dataType: "Double", value: 5}, StatusCodes.Good, date_add(today, {seconds: 5}));
        node.setValueFromSource({dataType: "Double", value: 6}, StatusCodes.Good, date_add(today, {seconds: 6}));

        node["hA Configuration"].startOfOnlineArchive.readValue().value.value.should.eql(today);


        var historyReadDetails = new historizing_service.ReadRawModifiedDetails({
            isReadModified: false,
            startTime: date_add(today, {seconds: -10}),
            endTime: date_add(today, {seconds: 10}),
            numValuesPerNode: 1000,
            returnBounds: true
        });
        var indexRange = null;
        var dataEncoding = null;
        var continuationPoint = null;


        node.historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, function (err, historyReadResult) {

            should.not.exist(historyReadResult.continuationPoint);
            historyReadResult.statusCode.should.eql(StatusCodes.Good);
            var dataValues = historyReadResult.historyData.dataValues;
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

        var node = addressSpace.addVariable({
            browseName: "MyVar",
            dataType: "Double",
            componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
        });
        addressSpace.installHistoricalDataNode(node, {
            maxOnlineValues: 3 // Only very few values !!!!
        });
        node["hA Configuration"].browseName.toString().should.eql("HA Configuration");

        // let's injects some values into the history
        var today = new Date();

        var historyReadDetails = new historizing_service.ReadRawModifiedDetails({
            isReadModified: false,
            startTime: date_add(today, {seconds: -10}),
            endTime: date_add(today, {seconds: 10}),
            numValuesPerNode: 1000,
            returnBounds: true
        });
        var indexRange = null;
        var dataEncoding = null;
        var continuationPoint = null;

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

                    var dataValues = historyReadResult.historyData.dataValues;
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

                    var dataValues = historyReadResult.historyData.dataValues;
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

                    var dataValues = historyReadResult.historyData.dataValues;
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

                    var dataValues = historyReadResult.historyData.dataValues;
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

                    var dataValues = historyReadResult.historyData.dataValues;
                    dataValues.length.should.eql(3);
                    dataValues[0].sourceTimestamp.should.eql(date_add(today, {seconds: 2}));
                    dataValues[1].sourceTimestamp.should.eql(date_add(today, {seconds: 3}));
                    dataValues[2].sourceTimestamp.should.eql(date_add(today, {seconds: 4}));
                    callback();
                });
            },
        ], done);

    });
});