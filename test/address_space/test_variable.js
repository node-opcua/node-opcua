
var address_space = require("../../lib/address_space/address_space");
var Variable = require("../../lib/address_space/variable").Variable;
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("../../lib/datamodel/variant").DataType;
var AttributeIds = require("../../lib/services/read_service").AttributeIds;
var should = require("should");
var NodeClass = require("../../lib/datamodel/nodeclass").NodeClass;

describe("testing Variables ",function(){

    it("a variable should return attributes with  the expected data type ",function(){

        var the_address_space = new address_space.AddressSpace();

        var v = new Variable({
            browseName: "some variable",
            address_space:the_address_space,
            minimumSamplingInterval: 10,
            userAccessLevel: 0,
            accessLevel: 0
        });

        var value ;

        v.readAttribute(AttributeIds.AccessLevel,function(value){
            value.value.dataType.should.eql(DataType.Byte);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.UserAccessLevel,function(value){
            value.value.dataType.should.eql(DataType.Byte);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.ValueRank,function(value){
            value.value.dataType.should.eql(DataType.Int32);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.Historizing,function(value){
            value.value.dataType.should.eql(DataType.Boolean);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.BrowseName,function(value){
            value.value.dataType.should.eql(DataType.QualifiedName);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.DisplayName,function(value){
            value.value.dataType.should.eql(DataType.LocalizedText);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.MinimumSamplingInterval,function(value){
            value.value.dataType.should.eql(DataType.UInt32);
            value.statusCode.should.eql(StatusCodes.Good);
        });

        v.readAttribute(AttributeIds.IsAbstract,function(value){
            value.statusCode.name.should.eql("BadAttributeIdInvalid");
        });

        v.readAttribute(AttributeIds.NodeClass,function(value){
            value.value.dataType.should.eql(DataType.Int32);
            value.value.value.should.eql(NodeClass.Variable.value);
            value.statusCode.should.eql(StatusCodes.Good);
        });
    });
});
