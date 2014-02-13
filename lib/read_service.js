
var factories = require("./factories");
var assert = require("assert");
var DataValue = require("./datavalue").DataValue;
var Variant   = require("./variant").Variant;

require("./part_8_structures");

var NumericRange_Schema = {
    name: "NumericRange",
    subtype: "UAString"
};
factories.registerObject(NumericRange_Schema);


exports.NumericRange = factories.registerObject(NumericRange_Schema);


var TimestampsToReturn_Schema = {
    name: "TimestampsToReturn",
    isEnum: true,
    enumValues: {
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    }
};
var TimestampsToReturn = exports.TimestampsToReturn = factories.registerObject(TimestampsToReturn_Schema);


var AttributeIds = {
    NodeId:1,
    NodeClass:2,
    BrowseName:3,
    DisplayName:4,
    Description:5,
    WriteMask:6,
    UserWriteMask:7,
    IsAbstract:8,
    Symmetric:9,
    InverseName:10,
    ContainsNoLoops:11,
    EventNotifier:12,
    Value:13,
    DataType:14,
    ValueRank:15,
    ArrayDimensions:16,
    AccessLevel:17,
    UserAccessLevel:18,
    MinimumSamplingInterval:19,
    Historizing:20,
    Executable:21,
    UserExecutable:22
};


var ReadValueId_Schema = {
    name: "ReadValueId",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId"}, // see AttributeIds
        { name: "indexRange" ,   fieldType: "NumericRange"    , defaultValue: function() { return null; }},
        { name: "dataEncoding",  fieldType: "QualifiedName"   , defaultValue: function() { return null; }}
    ]
};
exports.ReadValueId = factories.registerObject(ReadValueId_Schema);


var ReadRequest_Schema = {
    name: "ReadRequest",
    fields: [
        { name: "requestHeader" ,               fieldType: "RequestHeader"},
        { name: "maxAge",                       fieldType: "Duration"},
        { name: "timestampsToReturn" ,          fieldType: "TimestampsToReturn" , defaultValue: TimestampsToReturn.Neither},
        { name: "nodesToRead", isArray:true,    fieldType: "ReadValueId" }
    ]
};

exports.ReadRequest = factories.registerObject(ReadRequest_Schema);



var ReadResponse_Schema = {
    name: "ReadResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader"},
        { name: "results",          isArray:true, fieldType: "DataValue"},
        { name: "DiagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};

exports.ReadResponse = factories.registerObject(ReadResponse_Schema);
