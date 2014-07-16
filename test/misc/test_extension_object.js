/*global describe, require, it*/

var factories = require("../../lib/misc/factories");
var should = require("should");
var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;
var util = require("util");
var ec = require("../../lib/misc/encode_decode");

var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;


var ExtensionObject = require("../../lib/misc/extension_object").ExtensionObject;

describe("ExtensionObject", function () {

    var MetaShape_Schema = {
        name: "metashape",
        id: factories.next_available_id(),
        fields: [
            { name: "name", fieldType: "String"          },
            { name: "shape", fieldType: "ExtensionObject" },
            { name: "comment", fieldType: "String" }
        ]
    };

    var MetaShape = factories.registerObject(MetaShape_Schema);


    var Potato_Schema = {
        name: "Potato",
        id: factories.next_available_id(),
        fields: [
            { name: "length", fieldType: "Double"          },
            { name: "radius", fieldType: "Double"          }

        ]
    };
    var Potato = factories.registerObject(Potato_Schema);

    it("should work with some missing ExtensionObject ", function () {

        var shape = new MetaShape({
            name: "My Potato",
            shape: null,
            comment: "this is a comment"
        });
        shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShape_Schema.id));

        var stream = new BinaryStream(shape.binaryStoreSize());
        shape.encode(stream);
        encode_decode_round_trip_test(shape);
    });

    it("should work with some existing ExtensionObject ", function () {

        var shape = new MetaShape({
            name: "Potato",
            shape: new Potato({length: 10.0, radius: 5.0}),
            comment: "this is a comment"
        });
        shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShape_Schema.id));

        var stream = new BinaryStream(shape.binaryStoreSize());
        shape.encode(stream);

        encode_decode_round_trip_test(shape);

    });
});
