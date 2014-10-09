var factories = require("./../misc/factories");

var read_service = require("./read_service");
var TimestampsToReturn = read_service.TimestampsToReturn;

var AggregateConfiguration_Schema = {
    name: "AggregateConfiguration",
    //xx baseType:"ExtensionObject",
    isAbstract: true,
    fields: [
        { name: "useServerCapabilitiesDefaults", fieldType: "Boolean" },
        { name: "treatUncertainAsBad", fieldType: "Boolean" },
        { name: "percentDataBad", fieldType: "Byte"    },
        { name: "percentDataGood", fieldType: "Byte"    },
        { name: "useSlopedExtrapolation", fieldType: "Boolean" }
    ]
};
exports.AggregateConfiguration_Schema = AggregateConfiguration_Schema;
exports.AggregateConfiguration = factories.registerObject(AggregateConfiguration_Schema);


var HistoryReadValueId_Schema = {
    name: "HistoryReadValueId",
    // baseType: "ExtensionObject"
    fields: [
        {   name: "nodeId", fieldType: "NodeId"},
        {   name: "indexRange", fieldType: "String"},
        {   name: "dataEncoding", fieldType: "QualifiedName"},
        {   name: "continuationPoint", fieldType: "ByteString"}
    ]
};
exports.HistoryReadValueId_Schema = HistoryReadValueId_Schema;
exports.HistoryReadValueId = factories.registerObject(HistoryReadValueId_Schema);


var HistoryReadRequest_Schema = {
    name: "HistoryReadRequest",
    fields: [
        {   name: "requestHeader", fieldType: "RequestHeader"},

        {   name: "historyReadDetails", fieldType: "ExtensionObject" /* in fact a "HistoryReadDetails" */,
            documentation: "Maximum age of the value to be read in milliseconds"
        },
        {   name: "timestampsToReturn", fieldType: "TimestampsToReturn",
            documentation: "An enumeration that specifies the Timestamps to be returned for each requested Variable Value Attribute.",
            defaultValue: TimestampsToReturn.Neither
        },
        {
            name: "releaseContinuationPoints", fieldType: "Boolean"
        },
        { name: "nodesToRead", isArray: true, fieldType: "HistoryReadValueId",
            documentation: "List of Nodes and their Attributes to read. For each entry in this list, a StatusCode is " +
                "returned, and if it indicates success, the Attribute Value is also returned."
        }
    ]
};
exports.HistoryReadRequest_Schema = HistoryReadRequest_Schema;
exports.HistoryReadRequest = factories.registerObject(HistoryReadRequest_Schema);

var HistoryReadResult_Schema = {
    name: "HistoryReadResult",
    fields: [
        { name: "StatusCode", fieldType:"StatusCode" },
        { name: "ContinuationPoint", fieldType:"ByteString" },
        { name: "HistoryData", fieldType:"ExtensionObject"}
    ]
};
exports.HistoryReadResult_Schema = HistoryReadResult_Schema;
var HistoryReadResult = factories.registerObject(HistoryReadResult_Schema);

var HistoryReadResponse_Schema = {
    name: "HistoryReadResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"},
        {
            name: "results", isArray: true, fieldType: "HistoryReadResult"
        },
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.HistoryReadResponse_Schema = HistoryReadResponse_Schema;
exports.HistoryReadResponse = factories.registerObject(HistoryReadResponse_Schema);

var HistoryReadDetails_Schema = {
    name: "HistoryReadDetails",
    //xx baseType:"ExtensionObject",
    isAbstract: true,
    fields: []
};
exports.HistoryReadDetails_Schema = HistoryReadDetails_Schema;
factories.registerObject(HistoryReadDetails_Schema);


var MonitoringFilter_Schema = {
    name: "MonitoringFilter",
    //xx baseType:"ExtensionObject",
    isAbstract: true,
    fields: []
};
exports.MonitoringFilter_Schema = MonitoringFilter_Schema;
factories.registerObject(MonitoringFilter_Schema);



var EventFilter_Schema = {
    name: "EventFilter",
    baseType: "MonitoringFilter",
    fields: [
        // ToDo complete here
    ]
};
exports.EventFilter_Schema = EventFilter_Schema;
var EventFilter = factories.registerObject(EventFilter_Schema);



// <   BaseType="ua:">
var ReadEventDetails_Schema = {
    name: "ReadEventDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "numValuesPerNode", fieldType: "UInt32"   },
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "filter", fieldType: "EventFilter" }
    ]
};
exports.ReadEventDetails_Schema = ReadEventDetails_Schema;
exports.ReadEventDetails = factories.registerObject(ReadEventDetails_Schema);

var ReadRawModifiedDetails_Schema = {
    name: "ReadRawModifiedDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "isReadModified", fieldType: "Boolean"  },
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "numValuesPerNode", fieldType: "UInt32"   },
        { name: "returnBounds", fieldType: "Boolean"  }
    ]
};
exports.ReadRawModifiedDetails_Schema = ReadRawModifiedDetails_Schema;
exports.ReadRawModifiedDetails = factories.registerObject(ReadRawModifiedDetails_Schema);

var ReadProcessedDetails_Schema = {
    name: "ReadProcessedDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "startTime", fieldType: "DateTime" },
        { name: "endTime", fieldType: "DateTime" },
        { name: "processingInterval", fieldType: "DateTime" },
        { name: "aggregateType", isArray: true, fieldType: "NodeId" },
        { name: "aggregateConfiguration", fieldType: "AggregateConfiguration" }
    ]
};
exports.ReadProcessedDetails_Schema = ReadProcessedDetails_Schema;
exports.ReadProcessedDetails = factories.registerObject(ReadProcessedDetails_Schema);

var ReadAtTimeDetails_Schema = {
    name: "ReadAtTimeDetails",
    baseType: "HistoryReadDetails",
    fields: [
        { name: "reqTimes", isArray: true, fieldType: "DateTime" },
        { name: "useSimpleBounds", fieldType: "Boolean" }
    ]
};
exports.ReadAtTimeDetails_Schema = ReadAtTimeDetails_Schema;
exports.ReadAtTimeDetails = factories.registerObject(ReadAtTimeDetails_Schema);

