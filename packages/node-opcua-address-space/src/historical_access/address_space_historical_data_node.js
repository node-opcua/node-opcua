"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */

const assert = require("node-opcua-assert").assert;
const util = require("util");
const _ = require("underscore");


const historizing_service = require("node-opcua-service-history");
const HistoryReadRequest = historizing_service.HistoryReadRequest;
const HistoryReadDetails = historizing_service.HistoryReadDetails;
const HistoryReadResult = historizing_service.HistoryReadResult;
const HistoryData = historizing_service.HistoryData;

const AccessLevelFlag = require("node-opcua-data-model").AccessLevelFlag;
const makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;

const DataType = require("node-opcua-variant").DataType;

const StatusCodes = require("node-opcua-status-code").StatusCodes;

const UAVariable = require("../ua_variable").UAVariable;
const SessionContext = require("../session_context").SessionContext;

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
        const r = [];
        let c = q.head.next;
        while (c.data) {
            if (predicate(c.data)) {
                r.push(c.data);
            }
            c = c.next;
        }
        return r;
    }


    function _get_startOfOfflineArchive(node) {
        return node.$historicalDataConfiguration.startOfArchive.readValue();
    }
    function _get_startOfArchive(node) {
        return  node.$historicalDataConfiguration.startOfArchive.readValue();
    }

    function _update_startOfOnlineArchive(newDate) {
        const node = this;

        // The StartOfArchive Variable specifies the date before which there is no data in the archive either online or offline.
        // The StartOfOnlineArchive Variable specifies the date of the earliest data in the online archive.
        node.$historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
            dataType: DataType.DateTime, value: newDate
        });

        const startOfArchiveDataValue = _get_startOfOfflineArchive(node);
        if (startOfArchiveDataValue.statusCode !== StatusCodes.Good || startOfArchiveDataValue.value.value.getTime() >= newDate.getTime()) {
            node.$historicalDataConfiguration.startOfArchive.setValueFromSource({
                dataType: DataType.DateTime, value: newDate
            });
        }
    }

    function _historyPush(newDataValue) {

        const node = this;

        assert(node.hasOwnProperty("historizing"),"expecting a historizing attribute on node");

        if (!node.historizing) {
            return; //
        }
        assert(node.historizing === true);

        node._timeline.push(newDataValue);

        const sourceTime = newDataValue.sourceTimestamp || new Date();
        const sourcePicoSeconds = newDataValue.sourcePicoseconds || 0;

        // ensure that values are set with date increasing
        if (sourceTime.getTime() <= node.lastDate.getTime()) {
            if (!(sourceTime.getTime() === node.lastDate.getTime() && sourcePicoSeconds > node.lastDatePicoSeconds)) {
                console.log("Warning date not increasing ".red, newDataValue.toString(), " last known date = ", node.lastDate);
            }
        }

        node.lastDate = sourceTime;
        node.lastDatePicoSeconds = newDataValue.sourcePicoseconds || 0;

        // we keep only a limited amount in main memory
        if (node._timeline.length > node._maxOnlineValues) {
            assert(_.isNumber(node._maxOnlineValues) && node._maxOnlineValues > 0);
            while (node._timeline.length > node._maxOnlineValues) {
                node._timeline.shift();
            }
        }

        if (node._timeline.length >= node._maxOnlineValues || node._timeline.length === 1) {
            const first = node._timeline.first();
            _update_startOfOnlineArchive.call(node, first.sourceTimestamp);
            //we update the node startOnlineDate
        }

    }

    function _historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {
        //xx console.log("historyReadDetails = ", historyReadDetails.toString());
        assert(context instanceof SessionContext);
        assert(callback instanceof Function);
        const node = this;

        const dataValues = filter_dequeue(node._timeline, inInTimeRange.bind(null, historyReadDetails));

        const result = new HistoryReadResult({
            historyData: new HistoryData({dataValues: dataValues}),
            statusCode: StatusCodes.Good
        });
        //xx console.log(" Results = ",result.toString());
        callback(null, result);
    }

    const Dequeue = require("dequeue");

    function on_value_change(newDataValue) {
        const node = this;
        node._historyPush.call(node, newDataValue);
    }

    /**
     * @method installHistoricalDataNode
     * @param node      UAVariable
     * @param [options] {Object}
     * @param [options.maxOnlineValues = 1000]
     */
    function installHistoricalDataNode(node,options) {

        assert(node instanceof UAVariable);
        options = options || {};

        const addressSpace = node.addressSpace;

        // install specific history behavior
        node._historyRead = _historyRead;
        node._historyPush = _historyPush;


        node.lastDate = new Date(1600, 0, 1);
        node._timeline = new Dequeue();
        node._maxOnlineValues = options.maxOnlineValues || 1000;



        const historicalDataConfigurationType = addressSpace.findObjectType("HistoricalDataConfigurationType");
        node.historizing = true;
        node.accessLevel = AccessLevelFlag.get(node.accessLevel.key + " | CurrentRead | HistoryRead");
        node.userAccessLevel = AccessLevelFlag.get(node.userAccessLevel.key + " | CurrentRead | HistoryRead");

        const optionals = [
            "Definition",
            "MaxTimeInterval",
            "MinTimeInterval",
            "StartOfArchive",
            "StartOfOnlineArchive"
        ];

        // Note from spec : If a HistoricalDataNode has configuration defined then one
        //                    instance shall have a BrowseName of ‘HA Configuration’
        const historicalDataConfiguration = historicalDataConfigurationType.instantiate({
            browseName: "HA Configuration",
            optionals: optionals,
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
        const startOfOnlineArchive = new Date(Date.now);
        historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
            dataType: DataType.DateTime,
            value: startOfOnlineArchive
        });

        //TreatUncertainAsBad
        // The TreatUncertainAsBad Variable indicates how the Server treats data returned with a
        //    StatusCode severity Uncertain with respect to Aggregate calculations. A value of True indicates
        // the Server considers the severity equivalent to Bad, a value of False indicates the Server
        // considers the severity equivalent to Good, unless the Aggregate definition says otherwise. The
        // default value is True. Note that the value is still treated as Uncertain when the StatusCode for
        // the result is calculated.
        historicalDataConfiguration.aggregateConfiguration.treatUncertainAsBad.setValueFromSource({dataType: "Boolean", value: true});

        // The PercentDataBad Variable indicates the minimum percentage of Bad data in a given interval required for the
        // StatusCode for the given interval for processed data request to be set to Bad.
        // (Uncertain is treated as defined above.) Refer to 5.4.3 for details on using this Variable when assigning
        // StatusCodes. For details on which Aggregates use the PercentDataBad Variable, see
        // the definition of each Aggregate. The default value is 100.
        historicalDataConfiguration.aggregateConfiguration.percentDataBad.setValueFromSource({dataType:"Byte",value:100});

        // The PercentDataGood Variable indicates the minimum percentage of Good data in a given
        // interval required for the StatusCode for the given interval for the processed data requests to be
        // set to Good. Refer to 5.4.3 for details on using this Variable when assigning StatusCodes. For
        // details on which Aggregates use the PercentDataGood Variable, see the definition of each
        // Aggregate. The default value is 100.
        historicalDataConfiguration.aggregateConfiguration.percentDataGood.setValueFromSource({dataType:"Byte",value:100});

        //
        // The PercentDataGood and PercentDataBad shall follow the following relationship
        // PercentDataGood ≥ (100 – PercentDataBad). If they are equal the result of the
        // PercentDataGood calculation is used. If the values entered for PercentDataGood and
        //
        // PercentDataBad do not result in a valid calculation (e.g. Bad = 80; Good = 0) the result will
        // have a StatusCode of Bad_AggregateInvalidInputs The StatusCode
        //
        // Bad_AggregateInvalidInputs will be returned if the value of PercentDataGood or
        // PercentDataBad exceed 100.


        node.$historicalDataConfiguration = historicalDataConfiguration;

        const dataValue = node.readValue();
        if (dataValue.statusCode !== StatusCodes.BadWaitingForInitialData) {
            on_value_change.call(node,dataValue);
        }
        node.on("value_changed",on_value_change);

        // update the index of historizing nodes in the addressSpace
        node.addressSpace.historizingNodes = node.addressSpace.historizingNodes || {};
        node.addressSpace.historizingNodes[node.nodeId.toString()] = node;

    }

    AddressSpace.prototype.installHistoricalDataNode = installHistoricalDataNode;
};



