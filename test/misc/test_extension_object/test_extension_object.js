require("requirish")._(module);
/*global describe, require, it*/
import createObject from "lib/misc/create-factory";
var factories = require("lib/misc/factories");
var should = require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var util = require("util");
var ec = require("lib/misc/encode_decode");

var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;


var ExtensionObject = require("lib/misc/extension_object").ExtensionObject;

import { 
    MetaShapeForUnitTest_Schema,
    Potato_Schema 
} from './test_extension_object_schema'

describe("ExtensionObject", function () {

    createObject(MetaShapeForUnitTest_Schema, "tmp", "_schema");

    var MetaShape = factories.registerObject(MetaShapeForUnitTest_Schema, "tmp");

    createObject(Potato_Schema, "tmp", "_schema");

    var Potato = factories.registerObject(Potato_Schema, "tmp");

    it("should encode an object with an embedded ExtensionObject set to null ", function () {

        var shape = new MetaShape({
            name: "MyPotato",
            shape: null,
            comment: "this is a comment"
        });
        shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShapeForUnitTest_Schema.id));

        var stream = new BinaryStream(shape.binaryStoreSize());
        shape.encode(stream);
        encode_decode_round_trip_test(shape);
    });

    it("should encode an object with a valid embedded ExtensionObject", function () {

        var shape = new MetaShape({
            name: "Potato",
            shape: new Potato({length: 10.0, radius: 5.0}),
            comment: "this is a comment"
        });
        shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShapeForUnitTest_Schema.id));

        var stream = new BinaryStream(shape.binaryStoreSize());
        shape.encode(stream);

        encode_decode_round_trip_test(shape);

    });
});
