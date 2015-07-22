"use strict";
require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var AttributeIds = {
    NodeId: 1,
    NodeClass: 2,
    BrowseName: 3,
    DisplayName: 4,
    Description: 5,
    WriteMask: 6,
    UserWriteMask: 7,
    IsAbstract: 8,
    Symmetric: 9,
    InverseName: 10,
    ContainsNoLoops: 11,
    EventNotifier: 12,
    Value: 13,
    DataType: 14,
    ValueRank: 15,
    ArrayDimensions: 16,
    AccessLevel: 17,
    UserAccessLevel: 18,
    MinimumSamplingInterval: 19,
    Historizing: 20,
    Executable: 21,
    UserExecutable: 22,
    INVALID: 999
};
exports.AttributeIds = AttributeIds;
exports.AttributeNameById = _.invert(AttributeIds);


function is_valid_attributeId(attributeId) {
    assert(_.isFinite(attributeId));
    return attributeId >= 1 && attributeId <= 22;
}
exports.is_valid_attributeId = is_valid_attributeId;

