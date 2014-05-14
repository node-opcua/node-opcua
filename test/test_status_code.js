var assert = require('better-assert');
var StatusCodes = require("../lib/datamodel/opcua_status_code").StatusCodes;
var StatusCode = require("../lib/datamodel/opcua_status_code").StatusCode;
var encodeStatusCode  = require("../lib/datamodel/opcua_status_code").encodeStatusCode;
var decodeStatusCode  = require("../lib/datamodel/opcua_status_code").decodeStatusCode;
var should = require("should");
var BinaryStream = require("../lib/misc/binaryStream").BinaryStream;

describe("testing status code manipulation",function(){

    it("should create Bad_NodeIdExists",function(){

        StatusCodes.Bad_NodeIdExists.value.should.equal(94);
        StatusCodes.Bad_NodeIdExists.name.should.equal("Bad_NodeIdExists");
        StatusCodes.Bad_NodeIdExists.highword.should.equal(0x805E);

    });

    it("should create Bad_AttributeIdInvalid",function(){
        StatusCodes.Bad_AttributeIdInvalid.value.should.equal(53);
        StatusCodes.Bad_AttributeIdInvalid.name.should.equal("Bad_AttributeIdInvalid");
        StatusCodes.Bad_AttributeIdInvalid.highword.should.equal(0x8035);

    });

    it("should encode and decode a status code",function(){

        var stream = new BinaryStream(8);
        var statusCode = StatusCodes.Bad_NodeIdExists;
        encodeStatusCode(statusCode,stream);

        stream.rewind();
        var statusCode2 = decodeStatusCode(stream);

        statusCode2.should.eql(statusCode);

    });
    it("statusCode should implement a special toString",function(){

        StatusCodes.Bad_AttributeIdInvalid.should.be.instanceOf(StatusCode);
        StatusCodes.Bad_AttributeIdInvalid.toString().should.equal("Bad_AttributeIdInvalid (0x80350000)");
    });
});