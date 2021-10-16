/* eslint-disable no-undef */
"use strict";
const fs = require("fs");
const should = require("should");
const _ = require("underscore");
const utils = require("node-opcua-utils");
const factories = require("node-opcua-factory");

const ec = require("node-opcua-basic-types");

const { compare_obj_by_encoding, encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");

const generator = require("..");

require("../../node-opcua-data-model");

let temporary_folder = "";

function initialize() {
    const ShapeType = factories.registerEnumeration({
        name: "EnumShapeType",
        enumValues: {
            CIRCLE: 1,
            SQUARE: 2,
            RECTANGLE: 3,
            HEXAGON: 6
        }
    });

    const Color = factories.registerEnumeration({
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
                name: "name",
                fieldType: "String",
                defaultValue: function () {
                    return "my shape";
                }
            },
            { name: "shapeType", fieldType: "EnumShapeType" },
            { name: "color", fieldType: "EnumColor", defaultValue: Color.GREEN },
            {
                name: "inner_color",
                fieldType: "EnumColor",
                defaultValue: function () {
                    return Color.BLUE;
                }
            }
        ]
    };

    const path = require("path");
    const temporary_folder = path.join(__dirname, "..", "_test_generated");

    const Shape = generator.registerObject(exports.Shape_Schema, temporary_folder);

    factories.registerBasicType({
        name: "MyInteger",
        subType: "UInt16",
        defaultValue: 0
    });
}
xdescribe("Factories: testing object factory", function () {
    it("should handle subtype properly", function () {
        should.exist(factories.findSimpleType("MyInteger"));

        exports.MyStruct_Schema = {
            name: "MyStruct",
            id: factories.next_available_id(),
            fields: [{ name: "value", fieldType: "MyInteger" }]
        };
        generator.unregisterObject(exports.MyStruct_Schema, temporary_folder);
        const MyStruct = generator.registerObject(exports.MyStruct_Schema, temporary_folder);

        const s = new MyStruct();
        s.should.have.property("value");
        s.value.should.equal(0);

        generator.unregisterObject(exports.MyStruct_Schema, temporary_folder);
    });

    it("should handle StatusCode ", function () {
        const StatusCodes = require("node-opcua-status-code").StatusCodes;

        exports.MyStruct2_Schema = {
            name: "MyStruct2",
            id: factories.next_available_id(),
            fields: [
                { name: "value", fieldType: "MyInteger" },
                { name: "statusCode", fieldType: "StatusCode" }
            ]
        };
        generator.unregisterObject(exports.MyStruct2_Schema, temporary_folder);

        const MyStruct2 = generator.registerObject(exports.MyStruct2_Schema, temporary_folder);

        const s = new MyStruct2();
        s.should.have.property("value");
        s.should.have.property("statusCode");
        s.value.should.equal(0);
        s.statusCode.value.should.equal(0);
        s.statusCode.should.eql(StatusCodes.Good);
        // should.eql(StatusCodes.Good);
        generator.unregisterObject(exports.MyStruct2_Schema, temporary_folder);
    });

    it("should handle enumeration properly", function () {
        const shape = new Shape();

        shape.shapeType.should.eql(ShapeType.CIRCLE);
        shape.name.should.eql("my shape");
        shape.color.should.eql(Color.GREEN);

        shape.inner_color.should.eql(Color.BLUE);

        shape.shapeType = ShapeType.RECTANGLE;
        shape.shapeType.should.equal(ShapeType.RECTANGLE);

        (function () {
            shape.setShapeType(34);
        }.should.throw());
    });

    it("should allow enumeration value to be passed in options during construction", function () {
        const shape1 = new Shape({ shapeType: ShapeType.HEXAGON });
        shape1.shapeType.should.eql(ShapeType.HEXAGON);

        const shape2 = new Shape({ shapeType: ShapeType.RECTANGLE });
        shape2.shapeType.should.eql(ShapeType.RECTANGLE);
    });

    it("should encode and decode a structure containing a enumeration properly", function () {
        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, color: Color.BLUE });
        encode_decode_round_trip_test(shape);
    });

    it("should raise an exception when trying to pass an invalid field to constructor", function () {
        const schema_helpers = require("node-opcua-factory").parameters;

        const old_schema_helpers_doDebug = schema_helpers.debugSchemaHelper;
        schema_helpers.debugSchemaHelper = true;

        // redirect stdout to null as test will be noisy
        const old_process_stdout_write = process.stdout.write;

        (function test_constructor_with_invalid_args() {
            const a = new Shape({
                this_invalid_field_should_cause_Shape_Constructor_to_raise_an_exception: "**bingo**",

                name: "yo",
                shapeType: ShapeType.HEXAGON,
                color: Color.BLUE
            });
        }.should.throw());

        schema_helpers.debugSchemaHelper = old_schema_helpers_doDebug;
    });
});

xdescribe("Factories: testing strong typed enums", function () {
    it("should throw if a invalid argument is passed for an enum", function () {
        ShapeType.CIRCLE.key.should.equal("CIRCLE");
        const value = ShapeType.CIRCLE;
        value.should.equal(ShapeType.CIRCLE);

        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE });

        (function () {
            shape.setShapeType("toto");
        }.should.throw());
    });

    it("should be possible to initialize enumeration with string values", function () {
        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE });
        const shape2 = new Shape({ name: "yo", shapeType: "HEXAGON", inner_color: "RED", color: "BLUE" });

        shape.should.eql(shape2);
    });

    it("should be possible to initialize enumeration with integer values as well", function () {
        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE });
        const shape2 = new Shape({ name: "yo", shapeType: 6, inner_color: 100, color: 200 });

        shape.should.eql(shape2);
    });
});

xdescribe("Factories: testing binaryStoreSize", function () {
    it("should implement binaryStoreSize", function () {
        const shape = new Shape();

        shape.binaryStoreSize().should.be.greaterThan(10);
    });
});

xdescribe("Testing that objects created by factory can be persisted as JSON string", function () {
    it("should persist and restore a object in JSON ", function () {
        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE });

        const str = JSON.stringify(shape);

        const obj = new Shape(JSON.parse(str));

        obj.should.eql(shape);
    });

    it("should persist and restore a object in JSON when field has a special toJSON behavior", function () {
        exports.FakeBlob2_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob2",
            fields: [
                { name: "name", fieldType: "String" },
                { name: "buffer0", fieldType: "ByteString" },
                { name: "nodeId", fieldType: "NodeId" },
                { name: "createdOn", fieldType: "DateTime" }
            ]
        };
        generator.unregisterObject(exports.FakeBlob2_Schema, temporary_folder);
        const Blob = generator.registerObject(exports.FakeBlob2_Schema, temporary_folder);

        const blob = new Blob({
            buffer0: Buffer.from("00FF00AA", "hex"),
            nodeId: "ns=1;s=toto"
        });

        //Xx var str = JSON.stringify(blob,x=>x==="high_low" ? null :x);
        //Xx var obj = new Blob(JSON.parse(str));
        //Xxobj.should.eql(blob);

        generator.unregisterObject(exports.FakeBlob2_Schema, temporary_folder);
    });

    it("should persist and restore a object in JSON when field is a array of value with special toJSON behavior", function () {
        exports.FakeBlob3_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob3",
            fields: [
                { name: "name", fieldType: "String" },
                { name: "buffer0", isArray: true, fieldType: "ByteString" },
                { name: "nodeId", isArray: true, fieldType: "NodeId" }
            ]
        };
        generator.unregisterObject(exports.FakeBlob3_Schema, temporary_folder);
        const Blob = generator.registerObject(exports.FakeBlob3_Schema, temporary_folder);

        const blob = new Blob({
            buffer0: [Buffer.from("01020304", "hex"), [0, 1, 2, 3, 4]],
            nodeId: ["ns=1;s=toto", "ns=2;i=1234"]
        });

        blob.buffer0[0].should.be.instanceOf(Buffer);
        blob.buffer0[1].should.be.instanceOf(Buffer);

        const str = JSON.stringify(blob);

        console.log(chalk.yellow("JSON string"), str);

        const obj = new Blob(JSON.parse(str));

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
                { name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index" },
                {
                    name: "name",
                    fieldType: "String",
                    defaultValue: function () {
                        return null;
                    },
                    documentation: "The name"
                }
            ],

            toString: function () {
                return "ns=" + this.namespaceIndex + " name=" + this.name;
            }
        };
        generator.unregisterObject(exports.FakeQualifiedName_Schema, temporary_folder);

        const QualifiedName = generator.registerObject(exports.FakeQualifiedName_Schema, temporary_folder);

        const qname = new QualifiedName({
            namespaceIndex: 0
        });

        qname.toString().should.eql("ns=0 name=null");

        should(isFinite(qname.namespaceIndex)).be.equal(true);
        qname.namespaceIndex.should.equal(0);

        const str = JSON.stringify(qname);
        str.should.eql('{"namespaceIndex":0}');

        const obj = new QualifiedName(JSON.parse(str));
        obj.namespaceIndex.should.equal(0);
        should(isFinite(obj.namespaceIndex)).be.equal(true);

        obj.should.eql(qname);

        encode_decode_round_trip_test(qname);

        generator.unregisterObject(exports.FakeQualifiedName_Schema, temporary_folder);
    });
});

xdescribe("factories testing advanced cases", function () {
    it("should set a field to null when default value is specifically null and no value has been provided", function () {
        exports.Blob4_Schema = {
            name: "Blob4",
            id: factories.next_available_id(),
            fields: [{ name: "createdOn", fieldType: "DateTime", defaultValue: null }]
        };
        generator.unregisterObject(exports.Blob4_Schema, temporary_folder);
        const Blob4 = generator.registerObject(exports.Blob4_Schema, temporary_folder);

        const blob4 = new Blob4({
            createdOn: null
        });
        should(blob4.createdOn).be.eql(null);
        generator.unregisterObject(exports.Blob4_Schema, temporary_folder);
    });

    it("should accept all basic types as field scalar or field arrays", function () {
        const ExtensionObject = require("node-opcua-status-code").ExtensionObject;

        exports.Blob6_Schema = {
            name: "Blob6",
            id: factories.next_available_id(),
            fields: []
        };

        const _defaultTypeMap = require("node-opcua-factory").getTypeMap();

        _defaultTypeMap.forEach(function (value, key, map) {
            if (key === "Any") {
                return;
            }
            exports.Blob6_Schema.fields.push({ name: "value_" + key, fieldType: key });
            exports.Blob6_Schema.fields.push({ name: "array_" + key, fieldType: key, isArray: true });
        });

        const options = {};
        _defaultTypeMap.forEach(function (value, key) {
            if (key === "Any" || key === "Null" || key === "AccessLevelFlag") {
                return;
            }
            const type = value;

            const random = type.random || ec["random" + type.name];

            if (typeof random === "function") {
                options["value_" + key] = random();
                options["array_" + key] = [random(), random()];
            } else {
                options["value_" + key] = undefined;
                options["array_" + key] = [undefined, undefined];
            }
        });

        const Blob6 = generator.registerObject(exports.Blob6_Schema, temporary_folder);

        const blob = new Blob6(options);
        //xx console.log(blob);
        encode_decode_round_trip_test(blob);

        generator.unregisterObject(exports.Blob6_Schema, temporary_folder);
    });
});

xdescribe("BaseUAObject#clone ", function () {
    it("should clone a Shape", function () {
        const shape = new Shape({ name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE });
        const shape_clone = shape.clone();
        compare_obj_by_encoding(shape, shape_clone);
    });
});
