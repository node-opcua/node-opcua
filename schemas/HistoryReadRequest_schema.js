
var TimestampsToReturn = require("./TimestampsToReturn_enum").TimestampsToReturn;


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