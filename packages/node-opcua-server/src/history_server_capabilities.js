"use strict";
var _ = require("underscore");

/**
 * @class HistoryServerCapabilities
 * @param options
 * @param options.accessHistoryDataCapability
 * @param options.accessHistoryEventsCapability
 * @param options.maxReturnDataValues
 * @param options.maxReturnEventValues
 * @param options.insertDataCapability
 * @param options.replaceDataCapability
 * @param options.updateDataCapability
 * @param options.deleteRawCapability
 * @param options.deleteAtTimeCapability
 * @param options.insertEventCapability
 * @param options.replaceEventCapability
 * @param options.updateEventCapability
 * @param options.deleteEventCapability
 * @param options.insertAnnotationCapability
 * @constructor
 */
function HistoryServerCapabilities(options) {
    options = options || {};

    function coerceBool(value, defaultValue) {
        if (undefined === value) {
            return defaultValue;
        }
        assert(typeof value === "boolean");
        return value;
    }

    function coerceUInt32(value, defaultValue) {
        if (undefined === value) {
            return defaultValue;
        }
        assert(typeof value === "number");
        return value;
    }

    this.accessHistoryDataCapability = coerceBool(options.accessHistoryDataCapability, false);
    this.accessHistoryEventsCapability = coerceBool(options.accessHistoryEventsCapability, false);
    this.maxReturnDataValues = coerceUInt32(options.maxReturnDataValues, 0);
    this.maxReturnEventValues = coerceUInt32(options.maxReturnEventValues, 0);
    this.insertDataCapability = coerceBool(options.insertDataCapability, false);
    this.replaceDataCapability = coerceBool(options.replaceDataCapability, false);
    this.updateDataCapability = coerceBool(options.updateDataCapability, false);
    this.deleteRawCapability = coerceBool(options.deleteRawCapability, false);
    this.deleteAtTimeCapability = coerceBool(options.deleteAtTimeCapability, false);
    this.insertEventCapability = coerceBool(options.insertEventCapability, false);
    this.replaceEventCapability = coerceBool(options.replaceEventCapability, false);
    this.updateEventCapability = coerceBool(options.updateEventCapability, false);
    this.deleteEventCapability = coerceBool(options.deleteEventCapability, false);
    this.insertAnnotationCapability = coerceBool(options.insertAnnotationCapability, false);
};
exports.HistoryServerCapabilities = HistoryServerCapabilities;