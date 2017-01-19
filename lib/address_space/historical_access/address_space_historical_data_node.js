/**
 * @module opcua.address_space
 * @class AddressSpace
 */
import assert from "better-assert";
import util from "util";
import _ from "underscore";
import {NodeId} from "lib/datamodel/nodeid";
import {UADataType} from "lib/address_space/ua_data_type";
import {
  HistoryReadRequest,
  HistoryReadDetails,
  HistoryReadResult,
  HistoryData
} from "lib/services/historizing_service";
import {AccessLevelFlag} from "lib/datamodel/access_level";
import {makeAccessLevel} from "lib/datamodel/access_level";
import {DataType} from "lib/datamodel/variant";
import {StatusCodes} from "lib/datamodel/opcua_status_code";
import {UAVariable} from "lib/address_space/ua_variable";

export function install(AddressSpace) {
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

  function _historyRead(historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {
        // xx console.log("historyReadDetails = ", historyReadDetails.toString());
    const node = this;

    const dataValues = filter_dequeue(node._timeline, inInTimeRange.bind(null, historyReadDetails));

    const result = new HistoryReadResult({
      historyData: new HistoryData({ dataValues }),
      statusCode: StatusCodes.Good
    });
        // xx console.log(" Results = ",result.toString());
    callback(null, result);
  }

  const Dequeue = require("dequeue");

    /**
     *
     * @param node      UAVariable
     * @param [options] {Object}
     * @param [options.maxOnlineValues = 1000]
     */
  function installHistoricalDataNode(node,options) {
    assert(node instanceof UAVariable);
    options = options || {};

    const addressSpace = node.addressSpace;

    node._historyRead = _historyRead;
    node._timeline = new Dequeue();
    node._maxOnlineValues = options.maxOnlineValues || 1000;


    const historicalDataConfigurationType = addressSpace.findObjectType("HistoricalDataConfigurationType");
    node.historizing = true;
    node.accessLevel = AccessLevelFlag.get(`${node.accessLevel} | CurrentRead | HistoryRead`);
    node.userAccessLevel = AccessLevelFlag.get(`${node.userAccessLevel} | CurrentRead | HistoryRead`);

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
      optionals,
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
    historicalDataConfiguration.stepped.setValueFromSource({ dataType: "Boolean", value: false });

        // The MaxTimeInterval Variable specifies the maximum interval between data points in the
        // history repository regardless of their value change (see Part 3 for definition of Duration).
    historicalDataConfiguration.maxTimeInterval.setValueFromSource({ dataType: "Duration", value: 10 * 1000 });

        // The MinTimeInterval Variable specifies the minimum interval between data points in the
        // history repository regardless of their value change
    historicalDataConfiguration.minTimeInterval.setValueFromSource({ dataType: "Duration", value: 0.1 * 1000 });

        // The StartOfArchive Variable specifies the date before which there is no data in the archive
        //  either online or offline.

        // The StartOfOnlineArchive Variable specifies the date of the earliest data in the online archive.
    const startOfOnlineArchive = new Date(Date.now);
    historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
      dataType: DataType.DateTime,
      value: startOfOnlineArchive
    });

        // The MinTimeInterval Variable specifies the minimum interval between data points in the
        // history repository regardless of their value change (see Part 3 for definition of Duration).

    function _update_startOfOnlineArchive(newDate) {
      historicalDataConfiguration.startOfOnlineArchive.setValueFromSource({
        dataType: DataType.DateTime, value: newDate
      });
    }

    let lastDate = new Date(1600,0,1);

    node.on("value_changed", (newDataValue) => {
      node._timeline.push(newDataValue);

            // ensure that values are set with date increasing
      if (newDataValue.sourceTimestamp.getTime() <= lastDate.getTime()) {
        console.log("Warning date not increasing ".red,newDataValue.toString()," last known date = ",lastDate);
      }

      lastDate = newDataValue.sourceTimestamp;

            // we keep only a limited amount in main memory
      if (node._timeline.length > node._maxOnlineValues) {
        assert(_.isNumber(node._maxOnlineValues) && node._maxOnlineValues > 0);
        while (node._timeline.length > node._maxOnlineValues) {
          node._timeline.shift();
        }
      }
      if (node._timeline.length >= node._maxOnlineValues || node._timeline.length == 1) {
        const first = node._timeline.first();
        _update_startOfOnlineArchive(first.sourceTimestamp);
                // we update the node startOnlineDate
      }
    });
  }

  AddressSpace.prototype.installHistoricalDataNode = installHistoricalDataNode;
}

