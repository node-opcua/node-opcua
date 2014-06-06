//--------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//--------------------------------------------------------------------------------
var factories = require("./../misc/factories");
var assert = require('better-assert');
var DataValue = require("./../datamodel/datavalue").DataValue;
var Variant   = require("./../datamodel/variant").Variant;

require("./../datamodel/part_8_structures");

var NumericRange_Schema = {
    name: "NumericRange",
    subtype: "UAString"
};


factories.registerBasicType(NumericRange_Schema);


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
exports.AttributeIds = AttributeIds;



var ReadValueId_Schema = {
    name: "ReadValueId",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId"}, // see AttributeIds
        { name: "indexRange" ,   fieldType: "NumericRange"    , defaultValue: function() { return null; }},
        { name: "dataEncoding",  fieldType: "QualifiedName" }
    ]
};
exports.ReadValueId = factories.registerObject(ReadValueId_Schema);


/**
 * Maximum age of the value to be read in milliseconds. The age of the value is based on the difference between the
 * ServerTimestamp and the time when the Server starts processing the request. For example if the Client specifies a
 * maxAge of 500 milliseconds and it takes 100 milliseconds until the Server starts processing the request, the age of
 * the returned value could be 600 milliseconds prior to the time it was requested.
 * If the Server has one or more values of an Attribute that are within the maximum age, it can return any one of the
 * values or it can read a new value from the data source. The number of values of an Attribute that a Server has
 * depends on the number of MonitoredItems that are defined for the Attribute.
 * In any case, the Client can make no assumption about which copy of the data will be returned.
 * If the Server does not have a value that is within the maximum age, it shall attempt to read a new value from the
 * data source.
 * If the Server cannot meet the requested maxAge, it returns its “best effort” value rather than rejecting the request.
 * This may occur when the time it takes the Server to process and return the new data value after it has been accessed
 * is greater than the specified maximum age.
 * If maxAge is set to 0, the Server shall attempt to read a new value from the data source.
 * If maxAge is set to the max Int32 value or greater, the Server shall attempt to get a cached value.
 * Negative values are invalid for maxAge.
 */

var ReadRequest_Schema = {
    name: "ReadRequest",
    fields: [
        {   name: "requestHeader" ,               fieldType: "RequestHeader"},

        {   name: "maxAge",                       fieldType: "Duration",
            documentation: "Maximum age of the value to be read in milliseconds"
        },
        {   name: "timestampsToReturn" ,          fieldType: "TimestampsToReturn",
            documentation:"An enumeration that specifies the Timestamps to be returned for each requested Variable Value Attribute.",
            defaultValue: TimestampsToReturn.Neither
        },
        { name: "nodesToRead", isArray:true,    fieldType: "ReadValueId",
            documentation: "List of Nodes and their Attributes to read. For each entry in this list, a StatusCode is " +
                           "returned, and if it indicates success, the Attribute Value is also returned."
        }
    ]
};

exports.ReadRequest = factories.registerObject(ReadRequest_Schema);



var ReadResponse_Schema = {
    name: "ReadResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader"},
        {
            name: "results",          isArray:true, fieldType: "DataValue",
            documentation: "List of Attribute values as DataValue. The size and order of this list matches the size and"+
                           " order of the nodesToRead request parameter. There is one entry in this list for each Node "+
                           " contained in the nodesToRead parameter."
        },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};

exports.ReadResponse = factories.registerObject(ReadResponse_Schema);


