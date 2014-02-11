var DataValue = require("../lib/datavalue").DataValue;
var Variant = require("../lib/variant").Variant;
var DataType = require("../lib/variant").DataType;
var should = require("should");

var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("DataValue",function(){

    it("should create a empty DataValue and encode it as a 1-Byte length block",function(){

        var dataValue = new DataValue();

        encode_decode_round_trip_test(dataValue,function(buffer,id){
            buffer.length.should.equal(1);
        });
    });

    it("should create a DataValue with string variant and encode/decode it nicely ",function(){

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value:"Hello"})
        });
        encode_decode_round_trip_test(dataValue,function(buffer,id){
            buffer.length.should.equal(1 + 1 + 4 + 5);
        });
    });

    it("should create a DataValue with string variant and some date and encode/decode it nicely",function(){

        var dataValue = new DataValue({
            value: new Variant({dataType: DataType.String, value:"Hello"}),
            serverTimestamp: new Date(),
            serverPicoseconds: 1000
        });
        encode_decode_round_trip_test(dataValue,function(buffer,id){
        });
    });
});
