"use strict";
var assert = require("node-opcua-assert");
var UAVariable = require("../ua_variable").UAVariable;
var SessionContext = require("../session_context").SessionContext;

var StatusCodes = require("node-opcua-status-code").StatusCodes;

var historizing_service = require("node-opcua-service-history");
var HistoryReadResult = historizing_service.HistoryReadResult;

/**
 * @method historyRead
 * @param context {SessionContext}
 * @param historyReadDetails {HistoryReadDetails}
 * @param indexRange {NumericRange || null}
 * @param dataEncoding {String}
 * @param continuationPoint {ByteString}
 * @param callback {Function}
 * @param callback.err
 * @param callback.result {HistoryReadResult}
 */
UAVariable.prototype.historyRead = function (context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback) {

    assert(context instanceof SessionContext);
    assert(callback instanceof Function);

    if (typeof this["_historyRead"] !== "function") {
        return callback(null, new HistoryReadResult({statusCode: StatusCodes.BadNotReadable}));
    }

    if (continuationPoint) {
        console.warn(" Continuation point not supported in HistoryRead");
    }
    this._historyRead(context, historyReadDetails, indexRange, dataEncoding, continuationPoint, callback);
};
