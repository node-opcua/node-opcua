/* global describe,it*/
require("requirish")._(module);
var should = require("should");

var opcua = require("../../");
var DataType = opcua.DataType;

var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var ArgumentList_decode = require("lib/datamodel/argument_list").ArgumentList_decode;
var ArgumentList_encode = require("lib/datamodel/argument_list").ArgumentList_encode;
var ArgumentList_binaryStoreSize = require("lib/datamodel/argument_list").ArgumentList_binaryStoreSize;
var convertJavaScriptToVariant = require("lib/datamodel/argument_list").convertJavaScriptToVariant;


function extractValues(arrayVariant) {
    return arrayVariant.map(_.property("value"));
}

describe("convertJavaScriptToVariant", function(){

    it("should convertJavaScriptToVariant",function(){

        var definition = [{dataType: DataType.UInt32}];
        var arguments  = [100];

        var arguments_as_variant =  convertJavaScriptToVariant(definition,arguments);

        arguments_as_variant.length.should.eql(1);
        arguments_as_variant[0].should.eql(new Variant({dataType: DataType.UInt32,value: 100}));

        extractValues(arguments_as_variant).should.eql([100]);
    });
});


describe("testing ArgumentList special encode/decode process",function() {



    it("should raise an error when trying to **encode** a ArgumentList without a definition", function () {

        var stream = new BinaryStream(10);
        (function () {
            var arguments = [100];
            var definition = null;
            ArgumentList_encode(definition,arguments,stream);
        }).should.throw();

    });

    it("should raise an error when trying to **decode** a ArgumentList without a definition", function () {

        var stream = new BinaryStream(10);
        (function () {
            var definition = null;
            var arguments = ArgumentList_decode(definition,stream);
        }).should.throw();

    });

    it("should encode/decode an ArgumentList (scalar)", function () {

        var definition = [{dataType: DataType.UInt32}];
        var arguments  = [100];

        var size = ArgumentList_binaryStoreSize(definition,arguments);
        size.should.equal(4, " the size of a single UInt32");

        var stream = new BinaryStream(size);
        ArgumentList_encode(definition,arguments,stream);

        stream.rewind();
        var arguments_reloaded = ArgumentList_decode(definition,stream);

        _.isArray(arguments_reloaded).should.equal(true);
        arguments_reloaded[0].should.eql(100);

    });
    it("should encode/decode an ArgumentList (array)", function () {

        var definition = [{dataType: DataType.UInt32, valueRank: 1}];
        var arguments  = [[100, 200, 300]];

        var size = ArgumentList_binaryStoreSize(definition,arguments);
        size.should.equal(3 * 4 + 4, " the size of a 3 x UInt32  + length");

        var stream = new BinaryStream(size);
        ArgumentList_encode(definition,arguments,stream);

        stream.rewind();
        var arguments_reloaded = ArgumentList_decode(definition,stream);

        _.isArray(arguments_reloaded).should.equal(true);
        arguments_reloaded.length.should.eql(1);
        arguments_reloaded[0].length.should.eql(3);
        arguments_reloaded[0][0].should.eql(100);
        arguments_reloaded[0][1].should.eql(200);
        arguments_reloaded[0][2].should.eql(300);


    });

    it("should encode/decode an ArgumentList with a complex definition", function () {

        var definition = [
            {dataType: DataType.UInt32, name: "someValue"},
            {dataType: DataType.UInt32, valueRank: 1, name: "someValueArray"},
            {dataType: DataType.String, name: "someText"}
        ];

        var  arguments=  [10, [15, 20], "Hello"];

        var size = ArgumentList_binaryStoreSize(definition,arguments);

        var stream = new BinaryStream(size);
        ArgumentList_encode(definition,arguments,stream);


        // here the base dataType is created with its definition before decode is called
        stream.rewind();
        var arguments_reloaded = ArgumentList_decode(definition,stream);
        arguments_reloaded[0].should.equal(10);
        arguments_reloaded[1][0].should.equal(15);
        arguments_reloaded[1][1].should.equal(20);
        arguments_reloaded[2].should.equal("Hello");

    });



});
