
var TimestampsToReturn = require("./TimestampsToReturn_enum").TimestampsToReturn;

/*
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
 * @class ReadRequest
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
            defaultValue: TimestampsToReturn.Invalid
        },
        { name: "nodesToRead", isArray:true,    fieldType: "ReadValueId",
            documentation: "List of Nodes and their Attributes to read. For each entry in this list, a StatusCode is " +
            "returned, and if it indicates success, the Attribute Value is also returned."
        }
    ]
};
exports.ReadRequest_Schema = ReadRequest_Schema;