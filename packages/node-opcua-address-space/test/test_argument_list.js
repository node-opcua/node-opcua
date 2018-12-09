"use strict"
/* global describe,it*/

const should = require("should");
const _ = require("underscore");

const DataType = require("node-opcua-variant").DataType;
const Variant = require("node-opcua-variant").Variant;

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const decode_ArgumentList = require("../src/argument_list").decode_ArgumentList;
const encode_ArgumentList = require("../src/argument_list").encode_ArgumentList;
const binaryStoreSize_ArgumentList = require("../src/argument_list").binaryStoreSize_ArgumentList;
const convertJavaScriptToVariant = require("../src/argument_list").convertJavaScriptToVariant;

function extractValues(arrayVariant) {
    return arrayVariant.map(_.property("value"));
}

describe("convertJavaScriptToVariant", function () {

    it("should convertJavaScriptToVariant", function () {

        const definition = [{dataType: DataType.UInt32}];
        const args = [100];

        const args_as_variant = convertJavaScriptToVariant(definition, args);

        args_as_variant.length.should.eql(1);
        args_as_variant[0].should.eql(new Variant({dataType: DataType.UInt32, value: 100}));

        extractValues(args_as_variant).should.eql([100]);
    });
});


describe("testing ArgumentList special encode/decode process", function () {


    it("should raise an error when trying to **encode** a ArgumentList without a definition", function () {

        const stream = new BinaryStream();
        (function () {
            const args = [100];
            const definition = null;
            encode_ArgumentList(definition, args, stream);
        }).should.throw();

    });

    it("should raise an error when trying to **decode** a ArgumentList without a definition", function () {

        const stream = new BinaryStream();
        (function () {
            const definition = null;
            const args = decode_ArgumentList(definition, stream);
        }).should.throw();

    });

    it("should encode/decode an ArgumentList (scalar)", function () {

        const definition = [{dataType: DataType.UInt32}];
        const args = [100];

        const size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(4, " the size of a single UInt32");

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded[0].should.eql(100);

    });
    it("should encode/decode an ArgumentList (array)", function () {

        const definition = [{dataType: DataType.UInt32, valueRank: 1}];
        const args = [[100, 200, 300]];

        const size = binaryStoreSize_ArgumentList(definition, args);
        size.should.equal(3 * 4 + 4, " the size of a 3 x UInt32  + length");

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);

        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);

        _.isArray(args_reloaded).should.equal(true);
        args_reloaded.length.should.eql(1);
        args_reloaded[0].length.should.eql(3);
        args_reloaded[0][0].should.eql(100);
        args_reloaded[0][1].should.eql(200);
        args_reloaded[0][2].should.eql(300);


    });

    it("should encode/decode an ArgumentList with a complex definition", function () {

        const definition = [
            {dataType: DataType.UInt32, name: "someValue"},
            {dataType: DataType.UInt32, valueRank: 1, name: "someValueArray"},
            {dataType: DataType.String, name: "someText"}
        ];

        const args = [10, [15, 20], "Hello"];

        const size = binaryStoreSize_ArgumentList(definition, args);

        const stream = new BinaryStream(size);
        encode_ArgumentList(definition, args, stream);


        // here the base dataType is created with its definition before decode is called
        stream.rewind();
        const args_reloaded = decode_ArgumentList(definition, stream);
        args_reloaded[0].should.equal(10);
        args_reloaded[1][0].should.equal(15);
        args_reloaded[1][1].should.equal(20);
        args_reloaded[2].should.equal("Hello");

    });


});
