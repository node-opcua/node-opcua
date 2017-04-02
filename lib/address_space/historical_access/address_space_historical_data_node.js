"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var util = require("util");
var _ = require("underscore");

var NodeId = require("lib/datamodel/nodeid").NodeId;
var UADataType = require("lib/address_space/ua_data_type").UADataType;

var historizing_service = require("lib/services/historizing_service");
var HistoryReadRequest = historizing_service.HistoryReadRequest;
var HistoryReadDetails = historizing_service.HistoryReadDetails;
var HistoryReadResult = historizing_service.HistoryReadResult;
var HistoryData = historizing_service.HistoryData;
var AccessLevelFlag = require("lib/datamodel/access_level").AccessLevelFlag;
var makeAccessLevel = require("lib/datamodel/access_level").makeAccessLevel;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAVariable = require("lib/address_space/ua_variable").UAVariable;
var SessionContext = require("lib/server/session_context").SessionContext;
exports.install = function (AddressSpace) {

    function inInTimeRange(historyReadDetails, dataValue) {

        if (historyReadDetails.startTime && dataValue.sourceTimestamp < historyReadDetails.startTime) {
            return false;
        }
        if (historyReadDetails.endTime && dataValue.sourceTimestamp > historyReadDetails.endTime) {
            return false;
        }
        return true;
    }

    function filter_dequeue(q, predicate) {
        var r = [];
        var c = q.head.next;
        while (c.data) {
            if (predicate(c.data)) {
                r.push(c.data);
            }
            c = c.next;
        }
        return r;
    }

    function _update_startOfOnlineArchive(newDate) {
        var node = this;
        node.$historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
            dataType: DataType.DateTime, value: newDate
        });
    }

    function _historyPush(newDataValue) {

        var node = this;
        node._timeline.push(newDataValue);

        var sourceTime = newDataValue.sourceTimestamp || new Date();

        // ensure that values are set with date increasing
        if (sourceTime.getTime() <= node.lastDate.getTime()) {
            console.log("Warning date not increasing ".red, newDataValue.toString(), " last known date = ", lastDate);
        }

        node.lastDate = sourceTime;

        // we keep only a limited amount in main memory
        if (node._timeline.length > node._maxOnlineValues) {
            assert(_.isNumber(node._maxOnlineValues) && node._maxOnlineValues > 0);
            while (node._timeline.length > node._maxOnlineValues) {
                node._timeline.shift();
            }
        }
        if (node._timeline.length >= node._maxOnlineValues || node._timeline.length == 1) {
            var first = node._timeline.first();
            _update_startOfOnlineArchive.call(node, first.sourceTimestamp);
            //we update the node startOnlineDate
        }

    }

    function _historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {
        //xx console.log("historyReadDetails = ", historyReadDetails.toString());
        assert(context instanceof SessionContext);
        assert(callback instanceof Function);
        var node = this;

        var dataValues = filter_dequeue(node._timeline, inInTimeRange.bind(null, historyReadDetails));

        var result = new HistoryReadResult({
            historyData: new HistoryData({dataValues: dataValues}),
            statusCode: StatusCodes.Good
        });
        //xx console.log(" Results = ",result.toString());
        callback(null, result);
    }

    var Dequeue = require("dequeue");

    /**
     *
     * @param node      UAVariable
     * @param [options] {Object}
     * @param [options.maxOnlineValues = 1000]
     */
    function installHistoricalDataNode(node,options) {

        assert(node instanceof UAVariable);
        options = options || {};

        var addressSpace = node.addressSpace;

        // install specific history behavior
        node._historyRead = _historyRead;
        node._historyPush = _historyPush;


        node.lastDate = new Date(1600, 0, 1);
        node._timeline = new Dequeue();
        node._maxOnlineValues = options.maxOnlineValues || 1000;



        var historicalDataConfigurationType = addressSpace.findObjectType("HistoricalDataConfigurationType");
        node.historizing = true;
        node.accessLevel = AccessLevelFlag.get(node.accessLevel.key + " | CurrentRead | HistoryRead");
        node.userAccessLevel = AccessLevelFlag.get(node.userAccessLevel.key + " | CurrentRead | HistoryRead");

        var optionals = [
            "Definition",
            "MaxTimeInterval",
            "MinTimeInterval",
            "StartOfArchive",
            "StartOfOnlineArchive"
        ];

        // Note from spec : If a HistoricalDataNode has configuration defined then one
        //                    instance shall have a BrowseName of ‘HA Configuration’
        var historicalDataConfiguration = historicalDataConfigurationType.instantiate({
            browseName: "HA Configuration",
            optionals: optionals,
            // TODO : historicalConfigurationOf: node
        });

        // All Historical Configuration Objects shall be referenced using the HasHistoricalConfiguration ReferenceType.
        node.addReference({
            referenceType: "HasHistoricalConfiguration",
            isForward: true,
            nodeId: historicalDataConfiguration.nodeId
        });

        //  The Stepped Variable specifies whether the historical data was collected in such a manner
        //  that it should be displayed as SlopedInterpolation (sloped line between points) or as
        //  SteppedInterpolation (vertically-connected horizontal lines between points) when raw data is
        //  examined. This Property also effects how some Aggregates are calculated. A value of True
        //  indicates the stepped interpolation mode. A value of False indicates SlopedInterpolation
        //  mode. The default value is False.
        historicalDataConfiguration.stepped.setValueFromSource({dataType: "Boolean", value: false});

        // The MaxTimeInterval Variable specifies the maximum interval between data points in the
        // history repository regardless of their value change (see Part 3 for definition of Duration).
        historicalDataConfiguration.maxTimeInterval.setValueFromSource({dataType: "Duration", value: 10*1000});

        // The MinTimeInterval Variable specifies the minimum interval between data points in the
        // history repository regardless of their value change
        historicalDataConfiguration.minTimeInterval.setValueFromSource({dataType: "Duration", value: 0.1*1000});

        // The StartOfArchive Variable specifies the date before which there is no data in the archive
        //  either online or offline.

        // The StartOfOnlineArchive Variable specifies the date of the earliest data in the online archive.
        var startOfOnlineArchive = new Date(Date.now);
        historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
            dataType: DataType.DateTime,
            value: startOfOnlineArchive
        });

        node.$historicalDataConfiguration = historicalDataConfiguration;
        // The MinTimeInterval Variable specifies the minimum interval between data points in the
        // history repository regardless of their value change (see Part 3 for definition of Duration).


        node.on("value_changed", function (newDataValue) {
            node._historyPush.call(node, newDataValue);
        });
    }

    AddressSpace.prototype.installHistoricalDataNode = installHistoricalDataNode;
};



