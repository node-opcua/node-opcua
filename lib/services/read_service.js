//--------------------------------------------------------------------------------
// OPCUA Part 4 $5.10 : Attribute Service Set
// This Service Set provides Service sto access Attributes that are part of Nodes.
//--------------------------------------------------------------------------------
var factories = require("./../misc/factories");
var assert = require('better-assert');
var DataValue = require("./../datamodel/datavalue").DataValue;
var Variant   = require("./../datamodel/variant").Variant;
var _ = require("underscore");

require("./../datamodel/part_8_structures");

require("./../datamodel/numeric_range");



var TimestampsToReturn_Schema = {
    name: "TimestampsToReturn",
    enumValues: {
        Invalid:      -1,
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    },
    decode: function(stream) {

        var v = stream.readInt32();
        if (y<0 || y>3) {
            return TimestampsToReturn.Invalid;
        }
        return TimestampsToReturn.get(value);
    }
};
exports.TimestampsToReturn_Schema = TimestampsToReturn_Schema;
var TimestampsToReturn = exports.TimestampsToReturn = factories.registerEnumeration(TimestampsToReturn_Schema);


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
exports.AttributeNameById = _.invert(AttributeIds);


function is_valid_attributeId(attributeId){
    assert(_.isFinite(attributeId));
    return attributeId>=1 && attributeId<=22;
}
exports.is_valid_attributeId = is_valid_attributeId;

var ReadValueId_Schema = {
    name: "ReadValueId",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId" ,
            validate:function(value){
                return is_valid_attributeId(value);
            },
            defaultValue: AttributeIds.Value
        }, // see AttributeIds

        // IndexRange : This parameter is used to identify a single element of a structure or an array, or a single
        // range of indexes for arrays. If a range of elements  are specified, the values are returned as a composite.
        // The first element is identified by index 0 (zero).
        // This parameter is null if the specified Attribute is not an array or a structure. However, if the specified
        // Attribute is an array or a structure,and this parameter is null, then all elements are to be included in the
        // range.
        { name: "indexRange",   fieldType: "NumericRange"},

        // dataEncoding
        //
        //    This parameter specifies the BrowseName of the DataTypeEncoding that the
        //    Server should use when returning the Value Attribute of a Variable. It is an error
        //    to specify this parameter for other Attributes.
        //    A Client can discover what DataTypeEncodings are available by following the
        //    HasEncoding Reference from the DataType Node for a Variable.
        //    OPC UA defines BrowseNames which Servers shall recognize even if the
        //    DataType Nodes are not visible in the Server address space. These
        //    BrowseNames are:
        //      - DefaultBinary  The default or native binary (or non-XML) encoding.
        //      - DefaultXML  The default XML encoding.
        //
        //    Each DataType shall support at least one of these encodings. DataTypes that do
        //    not have a true binary encoding (e.g. they only have a non-XML text encoding)
        //    should use the DefaultBinary name to identify the encoding that is considered to
        //    be the default non-XML encoding. DataTypes that support at least one XML-based
        //    encoding shall identify one of the encodings as the DefaultXML encoding.
        //    Other standards bodies may define other well-known data encodings that could
        //    be supported.
        //
        //    If this parameter is not specified then the Server shall choose either the
        //    DefaultBinary or DefaultXML encoding according to what Message encoding
        //    (see Part 6) is used for the Session. If the Server does not support the encoding
        //    that matches the Message encoding then the Server shall choose the default
        //    encoding that it does support.
        //
        //    If this parameter is specified for a MonitoredItem, the Server shall set the
        //    StructureChanged bit in the StatusCode (see 7.33) if the DataTypeEncoding
        //    changes. The DataTypeEncoding changes if the DataTypeVersion of the
        //    DataTypeDescription or the DataTypeDictionary associated with the
        //    DataTypeEncoding changes
        { name: "dataEncoding",  fieldType: "QualifiedName" }
    ]
};
exports.ReadValueId_Schema = ReadValueId_Schema;
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
exports.ReadResponse_Schema = ReadResponse_Schema;
exports.ReadResponse = factories.registerObject(ReadResponse_Schema);


