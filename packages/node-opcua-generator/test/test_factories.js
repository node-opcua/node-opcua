"use strict";
var should = require("should");
var _ = require("underscore");

var generator = require("../src/generator");

var factories = require("node-opcua-factory");

var compare_obj_by_encoding = require("node-opcua-packet-analyzer/test_helpers/compare_obj_by_encoding").compare_obj_by_encoding;

var ec = require("node-opcua-basic-types");

var encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;


var ShapeType = factories.registerEnumeration({
    name: "EnumShapeType",
    enumValues: {
        CIRCLE: 1,
        SQUARE: 2,
        RECTANGLE: 3,
        HEXAGON: 6
    }
});

var Color = factories.registerEnumeration({
    name: "EnumColor",
    enumValues: {
        RED: 100,
        BLUE: 200,
        GREEN: 300
    }
});

exports.Shape_Schema = {
    id: factories.next_available_id(),
    name: "Shape",
    fields: [
        {
            name: "name", fieldType: "String", defaultValue: function () {
            return "my shape";
        }
        },
        {name: "shapeType", fieldType: "EnumShapeType"},
        {name: "color", fieldType: "EnumColor", defaultValue: Color.GREEN},
        {
            name: "inner_color", fieldType: "EnumColor", defaultValue: function () {
            return Color.BLUE;
        }
        }
    ]
};

var path = require("path");
var temporary_folder = path.join(__dirname,"..","_test_generated");

var Shape = generator.registerObject(exports.Shape_Schema, temporary_folder);

factories.registerBasicType({
    name: "MyInteger",
    subtype: "UInt16",
    defaultValue: 0
});

describe("Factories: testing object factory", function () {
    //
    // after(function () {
    //     try {
    //         generator.unregisterType("MyInteger");
    //     }
    //     catch (err) {/**/ }
    //
    // });
    //
    // before(function() {
    //     factories.registerBasicType({
    //         name: "MyInteger",
    //         subtype: "UInt16",
    //         defaultValue: 0
    //     });
    // });

    it("should handle subtype properly", function () {


        should.exist(factories.findSimpleType("MyInteger"));

        exports.MyStruct_Schema = {
            name: "MyStruct",
            id: factories.next_available_id(),
            fields: [
                {name: "value", fieldType: "MyInteger"}
            ]
        };
        generator.unregisterObject(exports.MyStruct_Schema, temporary_folder);
        var MyStruct = generator.registerObject(exports.MyStruct_Schema, temporary_folder);

        var s = new MyStruct();
        s.should.have.property("value");
        s.value.should.equal(0);

        generator.unregisterObject(exports.MyStruct_Schema, temporary_folder);

    });

    it("should handle StatusCode ", function () {

        var StatusCodes = require("node-opcua-status-code").StatusCodes;

        exports.MyStruct2_Schema = {
            name: "MyStruct2",
            id: factories.next_available_id(),
            fields: [
                {name: "value", fieldType: "MyInteger"},
                {name: "statusCode", fieldType: "StatusCode"}
            ]
        };
        generator.unregisterObject(exports.MyStruct2_Schema, temporary_folder);

        var MyStruct2 = generator.registerObject(exports.MyStruct2_Schema, temporary_folder);

        var s = new MyStruct2();
        s.should.have.property("value");
        s.should.have.property("statusCode");
        s.value.should.equal(0);
        s.statusCode.value.should.equal(0);
        s.statusCode.should.eql(StatusCodes.Good);
        // should.eql(StatusCode.Good);
        generator.unregisterObject(exports.MyStruct2_Schema, temporary_folder);

    });

    it("should handle enumeration properly", function () {

        var shape = new Shape();

        shape.shapeType.should.eql(ShapeType.CIRCLE);
        shape.name.should.eql("my shape");
        shape.color.should.eql(Color.GREEN);

        shape.inner_color.should.eql(Color.BLUE);

        shape.shapeType = ShapeType.RECTANGLE;
        shape.shapeType.should.equal(ShapeType.RECTANGLE);

        (function () {
            shape.setShapeType(34);
        }).should.throw();

    });

    it("should allow enumeration value to be passed in options during construction", function () {

        var shape1 = new Shape({shapeType: ShapeType.HEXAGON});
        shape1.shapeType.should.eql(ShapeType.HEXAGON);

        var shape2 = new Shape({shapeType: ShapeType.RECTANGLE});
        shape2.shapeType.should.eql(ShapeType.RECTANGLE);
    });

    it("should encode and decode a structure containing a enumeration properly", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, color: Color.BLUE});
        encode_decode_round_trip_test(shape);

    });

    it("should raise an exception when trying to pass an invalid field to constructor", function () {

        var schema_helpers =  require("node-opcua-factory/src/factories_schema_helpers");

        var old_schema_helpers_doDebug = schema_helpers.doDebug;
        schema_helpers.doDebug = true;
        // redirect stdout to null as test will be noisy
        var old_process_stdout_write = process.stdout.write;

        (function test_constructor_with_invalid_args() {
            var a = new Shape({

                this_invalid_field_should_cause_Shape_Constructor_to_raise_an_exception: "**bingo**",

                name: "yo",
                shapeType: ShapeType.HEXAGON,
                color: Color.BLUE
            });

        }).should.throw();

        schema_helpers.doDebug = old_schema_helpers_doDebug;
     });

});

describe("Factories: testing strong typed enums", function () {

    it("should throw if a invalid argument is passed for an enum", function () {


        ShapeType.CIRCLE.key.should.equal("CIRCLE");
        var value = ShapeType.CIRCLE;
        value.should.equal(ShapeType.CIRCLE);

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});

        (function () {
            shape.setShapeType("toto");
        }).should.throw();


    });

    it("should be possible to initialize enumeration with string values", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape2 = new Shape({name: "yo", shapeType: "HEXAGON", inner_color: "RED", color: "BLUE"});

        shape.should.eql(shape2);

    });

    it("should be possible to initialize enumeration with integer values as well", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape2 = new Shape({name: "yo", shapeType: 6, inner_color: 100, color: 200});

        shape.should.eql(shape2);

    });
});


describe("Factories: testing binaryStoreSize", function () {

    it("should implement binaryStoreSize", function () {

        var shape = new Shape();

        shape.binaryStoreSize().should.be.greaterThan(10);

    });
});



describe("Testing that objects created by factory can be persisted as JSON string", function () {


    it("should persist and restore a object in JSON ", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});

        var str = JSON.stringify(shape);

        var obj = new Shape(JSON.parse(str));

        obj.should.eql(shape);

    });

    it("should persist and restore a object in JSON when field has a special toJSON behavior", function () {

        exports.FakeBlob2_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob2",
            fields: [
                {name: "name", fieldType: "String"},
                {name: "buffer0", fieldType: "ByteString"},
                {name: "nodeId", fieldType: "NodeId"},
                {name: "createdOn", fieldType: "DateTime"}
            ]
        };
        generator.unregisterObject(exports.FakeBlob2_Schema, temporary_folder);
        var Blob = generator.registerObject(exports.FakeBlob2_Schema, temporary_folder);

        var blob = new Blob({
            buffer0: new Buffer("00FF00AA", "hex"),
            nodeId: "ns=1;s=toto"
        });
        var str = JSON.stringify(blob);

        var obj = new Blob(JSON.parse(str));

        obj.should.eql(blob);
        generator.unregisterObject(exports.FakeBlob2_Schema, temporary_folder);
    });

    it("should persist and restore a object in JSON when field is a array of value with special toJSON behavior", function () {

        exports.FakeBlob3_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob3",
            fields: [
                {name: "name", fieldType: "String"},
                {name: "buffer0", isArray: true, fieldType: "ByteString"},
                {name: "nodeId", isArray: true, fieldType: "NodeId"}
            ]
        };
        generator.unregisterObject(exports.FakeBlob3_Schema, temporary_folder);
        var Blob = generator.registerObject(exports.FakeBlob3_Schema, temporary_folder);

        var blob = new Blob({
            buffer0: [new Buffer("01020304", "hex"), [0, 1, 2, 3, 4]],
            nodeId: ["ns=1;s=toto", "ns=2;i=1234"]
        });

        blob.buffer0[0].should.be.instanceOf(Buffer);
        blob.buffer0[1].should.be.instanceOf(Buffer);

        var str = JSON.stringify(blob);

        console.log("JSON string".yellow, str.cyan);

        var obj = new Blob(JSON.parse(str));

        obj.buffer0[0].should.eql(blob.buffer0[0]);
        obj.buffer0[1].should.eql(blob.buffer0[1]);
        obj.should.eql(blob);

        generator.unregisterObject(exports.FakeBlob3_Schema, temporary_folder);

    });


    it("should persist and restore a object in JSON when field has a null value", function () {

        exports.FakeQualifiedName_Schema = {
            name: "FakeQualifiedName",
            id: factories.next_available_id(),
            fields: [
                {name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index"},
                {
                    name: "name", fieldType: "String", defaultValue: function () {
                    return null;
                }, documentation: "The name"
                }
            ],

            toString: function () {
                return "ns=" + this.namespaceIndex + " name=" + this.name;
            }
        };
        generator.unregisterObject(exports.FakeQualifiedName_Schema, temporary_folder);

        var QualifiedName = generator.registerObject(exports.FakeQualifiedName_Schema, temporary_folder);


        var qname = new QualifiedName({
            namespaceIndex: 0
        });

        qname.toString().should.eql("ns=0 name=null");

        should(_.isFinite(qname.namespaceIndex)).be.equal(true);
        qname.namespaceIndex.should.equal(0);

        var str = JSON.stringify(qname);
        str.should.eql("{\"namespaceIndex\":0}");

        var obj = new QualifiedName(JSON.parse(str));
        obj.namespaceIndex.should.equal(0);
        should(_.isFinite(obj.namespaceIndex)).be.equal(true);

        obj.should.eql(qname);

        encode_decode_round_trip_test(qname);

        generator.unregisterObject(exports.FakeQualifiedName_Schema, temporary_folder);
    });
});
describe("factories testing advanced cases", function () {

    it("should set a field to null when default value is specifically null and no value has been provided", function () {

        exports.Blob4_Schema = {
            name: "Blob4",
            id: factories.next_available_id(),
            fields: [
                {name: "createdOn", fieldType: "DateTime", defaultValue: null}
            ]
        };
        generator.unregisterObject(exports.Blob4_Schema, temporary_folder);
        var Blob4 = generator.registerObject(exports.Blob4_Schema, temporary_folder);

        var blob4 = new Blob4({
            createdOn: null
        });
        should(blob4.createdOn).be.eql(null);
        generator.unregisterObject(exports.Blob4_Schema, temporary_folder);

    });

    it("should accept all basic types as field scalar or field arrays", function () {

        var utils = require("node-opcua-utils");
        var fs = require("fs");
        // delete existing file if any

        //xx var filename = utils.getTempFilename("_auto_generated_Blob6.js");
        //xx if (fs.existsSync(filename)) {
        //xx     fs.unlinkSync(filename);
        //xx }

        var ExtensionObject = require("node-opcua-status-code").ExtensionObject;

        exports.Blob6_Schema = {
            name: "Blob6",
            id: factories.next_available_id(),
            fields: []
        };

        var _defaultTypeMap = require("node-opcua-factory/src/factories_builtin_types")._defaultTypeMap;
        var findBuiltInType = require("node-opcua-factory/src/factories_builtin_types").findBuiltInType;

        Object.keys(_defaultTypeMap).forEach(function (key) {
            if (key === "Any") { return; }
            exports.Blob6_Schema.fields.push({name: "value_" + key, fieldType: key});
            exports.Blob6_Schema.fields.push({name: "array_" + key, fieldType: key, isArray: true});
        });


        var options = {};
        Object.keys(_defaultTypeMap).forEach(function (key) {
            if (key === "Any" || key === "Null" || key === "AccessLevelFlag") { return; }
            var type = _defaultTypeMap[key];

            var random = type.random || ec["random" + type.name];

            if (_.isFunction(random)) {
                options["value_" + key] = random();
                options["array_" + key] = [random(), random()];
            } else {
                options["value_" + key] = undefined;
                options["array_" + key] = [undefined, undefined];

            }
        });

        var Blob6 = generator.registerObject(exports.Blob6_Schema, temporary_folder);

        var blob = new Blob6(options);
        //xx console.log(blob);
        encode_decode_round_trip_test(blob);

        generator.unregisterObject(exports.Blob6_Schema, temporary_folder);
    });


});

describe("BaseUAObject#clone ",function() {


    it("should clone a Shape",function() {
        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape_clone = shape.clone();
        compare_obj_by_encoding(shape,shape_clone);
    });

});
