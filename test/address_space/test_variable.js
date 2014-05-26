
var address_space = require("../../lib/address_space/address_space");
var Variable = require("../../lib/address_space/variable").Variable;
var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
var DataType = require("../../lib/datamodel/variant").DataType;
var AttributeIds = require("../../lib/services/read_service").AttributeIds;
var should = require("should");

describe("testing Variables ",function(){

    it("a variable should return attributes with  the expected data type ",function(){

        var as = new address_space.AddressSpace();

        var v = new Variable({
            address_space:as,
            minimumSamplingInterval: 10,
            userAccessLevel: 0,
            accessLevel: 0,

        });

        var value ;

        value = v.readAttribute(AttributeIds.AccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.UserAccessLevel);
        value.value.dataType.should.eql(DataType.Byte);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.ValueRank);
        value.value.dataType.should.eql(DataType.Int32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.Historizing);
        value.value.dataType.should.eql(DataType.Boolean);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.BrowseName);
        value.value.dataType.should.eql(DataType.QualifiedName);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.DisplayName);
        value.value.dataType.should.eql(DataType.LocalizedText);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.MinimumSamplingInterval);
        value.value.dataType.should.eql(DataType.UInt32);
        value.statusCode.should.eql(StatusCodes.Good);

        value = v.readAttribute(AttributeIds.IsAbstract);
        value.statusCode.name.should.eql("Bad_AttributeIdInvalid");


    });

});
