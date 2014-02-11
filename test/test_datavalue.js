var DataValue = require("../lib/datavalue").DataValue;
var Variant = require("../lib/variant").Variant;
var should = require("should");

var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

describe("DataValue",function(){
    it("should create a empty DataValue and encode it as a 1-Byte length block",function(){

        var dataValue = new DataValue();

        console.dir(dataValue);

        encode_decode_round_trip_test(dataValue,function(buffer,id){
            buffer.length.should.equal(1);
        });
    })
})
