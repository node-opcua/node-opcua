"use strict";
const path = require("path");
const should = require("should");

const { encode_decode_round_trip_test } = require("node-opcua-packet-analyzer/dist/test_helpers");

xdescribe("Code Generator", function () {
    const schema_file = path.join(__dirname, "./fixture/fixture_dummy_object_schema.js");

    it("should produce the javascript for new complex type using template ", function () {
        // code should compile
        const DummyObject = require(schema_file).DummyObject;
        const SomeEnumeration = require(schema_file).SomeEnumeration;

        const dummy = new DummyObject({
            viewVersion: 50,
            name: "Paris",
            ArrayInt: [10, 20, 30],
            typeEnum: 2
        });
        dummy.viewVersion.should.eql(50);
        dummy.name.should.eql("Paris");
        dummy.ArrayInt.should.eql([10, 20, 30]);
        dummy.typeEnum.should.eql(SomeEnumeration.SQUARE);

        const dummy_reloaded = encode_decode_round_trip_test(dummy);

        dummy_reloaded.viewVersion.should.eql(dummy.viewVersion);
        dummy_reloaded.name.should.eql(dummy.name);
        dummy_reloaded.ArrayInt.should.eql([10, 20, 30]);
        dummy_reloaded.typeEnum.should.eql(dummy.typeEnum);

        (function () {
            dummy.setTypeEnum("toto");
        }.should.throw());
    });
    it("should handle new type with base class ", function () {
        const FooBarDerived = require(schema_file).FooBarDerived;
        const FooBar = require(schema_file).FooBar;

        const fb = new FooBarDerived({ name: "toto", name2: "titi" });
        fb.name.should.eql("toto");
        fb.name2.should.eql("titi");

        fb.should.be.instanceOf(FooBarDerived);
        fb.should.be.instanceOf(FooBar);

        const fb_reloaded = encode_decode_round_trip_test(fb);
        fb_reloaded.name.should.eql(fb.name);
        fb_reloaded.name2.should.eql(fb.name2);
    });

    it("should handle Schema with recursion ", function () {
        //xx should(function(){
        const schema_file2 = path.join(__dirname, "./fixture/fixture_foo_object_with_recursion_schema.js");
        const FooWithRecursion = require(schema_file2).FooWithRecursion;
        //xx }).not.throwError();

        let foo = new FooWithRecursion({});

        should(foo.inner).be.eql(null);
        // var foo_reloaded = encode_decode_round_trip_test(foo);

        foo = new FooWithRecursion({
            inner: { name: "inside level1" }
        });

        should.exist(foo.inner);
        foo.inner.name.should.eql("inside level1");
        should(foo.inner.inner).eql(null);

        foo = new FooWithRecursion({
            inner: {
                name: "inside level1",
                inner: {
                    name: "inside level2"
                }
            }
        });
        should.exist(foo.inner);
        foo.inner.name.should.eql("inside level1");
        should.exist(foo.inner.inner);
        foo.inner.inner.name.should.eql("inside level2");
        should.not.exist(foo.inner.inner.inner);
    });
});
