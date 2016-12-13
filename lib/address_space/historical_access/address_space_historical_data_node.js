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

    function _historyRead(historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {
        //xx console.log("historyReadDetails = ", historyReadDetails.toString());
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

    function installHistoricalDataNode(node) {

        var addressSpace = node.addressSpace;

        node._historyRead = _historyRead;
        node._timeline = new Dequeue();

        var historicalDataConfigurationType = addressSpace.findObjectType("HistoricalDataConfigurationType");
        node.historizing = true;
        node.accessLevel = AccessLevelFlag.get(node.accessLevel + " | CurrentRead | HistoryRead");
        node.userAccessLevel = AccessLevelFlag.get(node.userAccessLevel + " | CurrentRead | HistoryRead");

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
            isFoward: true,
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
        historicalDataConfiguration.maxTimeInterval.setValueFromSource({dataType: "Duration", value: 10});

        // The StartOfArchive Variable specifies the date before which there is no data in the archive
        //  either online or offline.

        // The StartOfOnlineArchive Variable specifies the date of the earliest data in the online archive.
        var startOfOnlineArchive = new Date(Date.now);
        historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
            dataType: DataType.DateTime,
            value: startOfOnlineArchive
        });

        // The MinTimeInterval Variable specifies the minimum interval between data points in the
        // history repository regardless of their value change (see Part 3 for definition of Duration).

        node.on("value_changed", function (newDataValue) {
            node._timeline.push(newDataValue);

            // we keep only a limited amount in main memory
            if (node._timeline.length > 2000) {
                node._timeline.shift();

                var first = node._timeline.first();
                //we update the node startOnlineDate
                historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
                    dataType: DataType.DateTime, value: first.sourceTimestamp
                });

            }
        });
    }

    AddressSpace.prototype.installHistoricalDataNode = installHistoricalDataNode;
};



