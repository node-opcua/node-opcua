"use strict"
/* global describe,it*/

var should = require("should");
var _ = require("underscore");

var DataType = require("node-opcua-variant").DataType;
var Variant = require("node-opcua-variant").Variant;

var BinaryStream = require("node-opcua-binary-stream").BinaryStream;
var decode_ArgumentList = require("../src/argument_list").decode_ArgumentList;
var encode_ArgumentList = require("../src/argument_list").encode_ArgumentList;
var binaryStoreSize_ArgumentList = require("../src/argument_list").binaryStoreSize_ArgumentList;
var convertJavaScriptToVariant = require("../src/argument_list").convertJavaScriptToVariant;

function extractValues(arrayVariant) {
    return arrayVariant.map(_.property("value"));
}

describe("convertJavaScriptToVariant", function () {

    it("should convertJavaScriptToVariant", function () {

        var definition = [{dataType: DataType.UInt32}];
        var args = [100];

        var args_as_variant = convertJavaScriptToVariant(definition, args);

        args_as_variant.length.should.eql(1);
        args_as_variant[0].should.eql(new Variant({dataType: DataType.UInt32, value: 100}));

        extractValues(args_as_variant).should.eql([100]);
    });
});


describe("testing ArgumentList special encode/decode process", function () {


    it("should raise an error when trying to **encode** a ArgumentList without a definition", function () {

        var stream = new BinaryStream();
        (function () {
            var args = [100];
            var definition = null;
            encode_ArgumentList(definition, args, stream);
        }).should.throw();

    });

    it("should raise an error when trying to **decode** a ArgumentList without a definition", function () {

        var stream = new BinaryStream();
        (function () {
            var definition = null;
            var args = decode_ArgumentList(definition, stream);
        }).should.throw();

    });

    it("should encode/decode an ArgumentList (scalar)", function () {

        var definition = [{dataType: DataType.UInt32}];
        var args = [100];

        var size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(4, " the size of a single UInt32");

        var stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        var args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded[0].should.eql(100);

    });
    it("should encode/decode an ArgumentList (array)", function () {

        var definition = [{dataType: DataType.UInt32, valueRank: 1}];
        var args = [[100, 200, 300]];

        var size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(3 * 4 + 4, " the size of a 3 x UInt32  + length");

        var stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        var args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded.length.should.eql(1);
        args_reloaded[0].length.should.eql(3);
        args_reloaded[0][0].should.eql(100);
        args_reloaded[0][1].should.eql(200);
        args_reloaded[0][2].should.eql(300);


    });

    it("should encode/decode an ArgumentList with a complex definition", function () {

        var definition = [
            {dataType: DataType.UInt32, name: "someValue"},
            {dataType: DataType.UInt32, valueRank: 1, name: "someValueArray"},
            {dataType: DataType.String, name: "someText"}
        ];

        var args = [10, [15, 20], "Hello"];

        var size = binaryStoreSize_ArgumentList(definition, args);

        var stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);


        // here the base dataType is created with its definition before decode is called
        stream.rewind();
        var args_reloaded = decode_ArgumentList(definition, stream);
        args_reloaded[0].should.equal(10);
        args_reloaded[1][0].should.equal(15);
        args_reloaded[1][1].should.equal(20);
        args_reloaded[2].should.equal("Hello");

    });


});
