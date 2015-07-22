/**
 * @module opcua.server
 */
require("requirish")._(module);
var crypto = require("crypto");
var assert = require("better-assert");

var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var counter = 0;
function make_key() {
    // return crypto.randomBytes(32);
    counter += 1;
    return new Buffer(counter.toString(), "ascii");
}

function ContinuationPointManager() {
    this._map = {};
}
ContinuationPointManager.prototype.register = function (maxElements, values) {

    maxElements = maxElements || values.length;
    if (maxElements >= values.length) {
        return {
            statusCode: StatusCodes.Good,
            continuationPoint: null,
            references: values
        };
    }

    var key = make_key();
    var keyHash = key.toString("ascii");

    // split the array in two ( values)
    var current_block = values.splice(0, maxElements);

    var result = {
        statusCode: StatusCodes.Good,
        continuationPoint: key,
        references: current_block
    };

    // create
    var data = {
        maxElements: maxElements,
        remainingElements: values
    };
    this._map[keyHash] = data;

    return result;

};
ContinuationPointManager.prototype.getNext = function (continuationPoint) {

    if (!continuationPoint) {
        return {statusCode: StatusCodes.BadContinuationPointInvalid};
    }
    var keyHash = continuationPoint.toString("ascii");

    var data = this._map[keyHash];
    if (!data) {
        return {statusCode: StatusCodes.BadContinuationPointInvalid};
    }
    assert(data.maxElements > 0);
    // split the array in two ( values)
    var current_block = data.remainingElements.splice(0, data.maxElements);

    var result = {
        statusCode: StatusCodes.Good,
        continuationPoint: data.remainingElements.length ? continuationPoint : null,
        references: current_block
    };
    if (data.remainingElements.length === 0) {
        // we are done
        delete this._map[keyHash];
    }
    return result;
};

var nullBuffer = new Buffer(0);

ContinuationPointManager.prototype.cancel = function (continuationPoint) {

    if (!continuationPoint) {
        return {statusCode: StatusCodes.BadContinuationPointInvalid};
    }

    var keyHash = continuationPoint.toString("ascii");

    var data = this._map[keyHash];
    if (!data) {
        return {
            statusCode: StatusCodes.BadContinuationPointInvalid,
            continuationPoint: null,// nullBuffer,
            references: []
        };
    }
    delete this._map[keyHash];
    return {
        statusCode: StatusCodes.Good
    };

};


exports.ContinuationPointManager = ContinuationPointManager;
