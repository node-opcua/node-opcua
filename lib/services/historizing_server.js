var factories = require("./../misc/factories");

var HistoryReadRequest_Schema = {
    name: "HistoryReadRequest",
    fields: [
        {   name: "requestHeader" ,               fieldType: "RequestHeader"},

        {   name: "historyReadDetails",                       fieldType: "HistoryReadDetails",
            documentation: "Maximum age of the value to be read in milliseconds"
        },
        {   name: "timestampsToReturn" ,          fieldType: "TimestampsToReturn",
            documentation:"An enumeration that specifies the Timestamps to be returned for each requested Variable Value Attribute.",
            defaultValue: TimestampsToReturn.Neither
        },
        {
            name: "releaseContinuationPoints", fieldType: "Boolean"
        },
        { name: "nodesToRead", isArray:true,    fieldType: "HistoryReadValueId",
            documentation: "List of Nodes and their Attributes to read. For each entry in this list, a StatusCode is " +
                "returned, and if it indicates success, the Attribute Value is also returned."
        }
    ]
};

exports.HistoryReadRequest = factories.registerObject(HistoryReadRequest_Schema);


var HistoryReadRequest_Schema = {
    name: "HistoryReadRequest",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader"},
        {
            name: "results",         isArray:true, fieldType: "HistoryReadResult"
        },
        { name: "diagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};

exports.HistoryReadRequest = factories.registerObject(HistoryReadRequest_Schema);

// <HistoryReadDetails   BaseType="ua:ExtensionObject">
var ReadEventDetails_Schema = {
    // base :  HistoryReadDetails
    name: "ReadEventDetails",
    fields: [
        { name: "numValuesPerNode",                 fieldType: "UInt32"   },
        { name: "startTime",                        fieldType: "DateTime" },
        { name: "endTime",                          fieldType: "DateTime" },
        { name: "filter",                           fieldType: "EventFilter" }
    ]
};

exports.ReadEventDetails = factories.registerObject(ReadEventDetails_Schema);

var ReadRawModifiedDetails_Schema = {
    // base :  HistoryReadDetails
    name: "ReadRawModifiedDetails",
    fields: [
        { name: "isReadModified",                   fieldType: "Boolean"  },
        { name: "startTime",                        fieldType: "DateTime" },
        { name: "endTime",                          fieldType: "DateTime" },
        { name: "numValuesPerNode",                 fieldType: "UInt32"   },
        { name: "returnBounds",                     fieldType: "Boolean"  }
    ]
};

exports.ReadRawModifiedDetails = factories.registerObject(ReadRawModifiedDetails_Schema);

var ReadProcessedDetails_Schema = {
    // base :  HistoryReadDetails
    name: "ReadProcessedDetails",
    fields: [
        { name: "startTime",                        fieldType: "DateTime" },
        { name: "endTime",                          fieldType: "DateTime" },
        { name: "processingInterval",               fieldType: "DateTime" },
        { name: "aggregateType",    isArray: true,  fieldType: "NodeId" },
        { name: "aggregateConfiguration",           fieldType: "AggregateConfiguration" },
    ]
};

exports.ReadProcessedDetails = factories.registerObject(ReadProcessedDetails_Schema);

var ReadAtTimeDetails_Schema = {
    // base :  HistoryReadDetails
    name: "ReadAtTimeDetails",
    fields: [
        { name: "reqTimes",   isArray:true,      fieldType: "DateTime" },
        { name: "useSimpleBounds",               fieldType: "Boolean" }
    ]
};

exports.ReadAtTimeDetails = factories.registerObject(ReadAtTimeDetails_Schema);


/**
<opc:StructuredType Name="AggregateConfiguration" BaseType="ua:ExtensionObject">
    <opc:Field Name="UseServerCapabilitiesDefaults" TypeName="opc:Boolean" />
    <opc:Field Name="TreatUncertainAsBad" TypeName="opc:Boolean" />
    <opc:Field Name="PercentDataBad" TypeName="opc:Byte" />
    <opc:Field Name="PercentDataGood" TypeName="opc:Byte" />
    <opc:Field Name="UseSlopedExtrapolation" TypeName="opc:Boolean" />
</opc:StructuredType>
*
*/
