
var factories = require("./factories");
var assert = require("assert");
var DataValue = require("./datavalue").DataValue;
var Variant   = require("./variant").Variant;


var NumericRange_Description = {
    name: "NumericRange",
    id: factories.next_available_id(),
    fields: [
        { name:"_" , fieldType:"String"}
    ]
};
exports.NumericRange = factories.UAObjectFactoryBuild(NumericRange_Description);


var TimestampsToReturn_Description = {
    name: "TimestampsToReturn",
    isEnum: true,
    enumValues: {
        Source:        0,
        Server:        1,
        Both:          2,
        Neither :      3
    }
};
exports.TimestampsToReturn = factories.UAObjectFactoryBuild(TimestampsToReturn_Description);

var ReadValueId_Description = {
    name: "ReadValueId",
    fields: [
        { name: "nodeId" ,       fieldType: "NodeId"},
        { name: "attributeId" ,  fieldType: "IntegerId"},
        { name: "indexRange" ,   fieldType: "NumericRange"},
        { name: "dataEncoding",  fieldType: "QualifiedName" }
    ]
};
exports.ReadValueId = factories.UAObjectFactoryBuild(ReadValueId_Description);


var ReadRequest_Description = {
    name: "ReadRequest",
    fields: [
        { name: "requestHeader" , fieldType: "RequestHeader"},
        { name: "maxAge" , fieldType: "Duration"},
        { name: "timestampsToReturn" , fieldType: "TimestampsToReturn"},
        { name: "nodesToRead", isArray:true,  fieldType: "ReadValueId" }
    ]
};

exports.ReadRequest = factories.UAObjectFactoryBuild(ReadRequest_Description);



var ReadResponse_Description = {
    name: "ReadResponse",
    fields: [
        { name: "responseHeader" ,                fieldType: "ResponseHeader"},
        { name: "results",          isArray:true, fieldType: "DataValue"},
        { name: "DiagnosticInfos", isArray:true,  fieldType: "DiagnosticInfo" }
    ]
};

exports.ReadResponse = factories.UAObjectFactoryBuild(ReadResponse_Description);
