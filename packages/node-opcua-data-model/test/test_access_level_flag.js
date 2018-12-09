const should = require("should");
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const path = require("path");

const AccessLevelFlag = require("..").AccessLevelFlag;
const makeAccessLevel = require("..").makeAccessLevel;
const findBuiltInType = require("node-opcua-factory").findBuiltInType;

const generator = require("node-opcua-generator");

const tmpfolder  = path.join(__dirname,"../_test_generated");
const ObjWithAccessLevel = generator.registerObject(path.join(__dirname,"fixture_schemas")+"|ObjWithAccessLevel", tmpfolder);

assert(_.isFunction(ObjWithAccessLevel));

describe("Testing AccessLevelFlag", function () {

    it("should create a access level flags from a string", function () {

        makeAccessLevel("CurrentRead").value.should.equal(0x01);
        makeAccessLevel("CurrentWrite").value.should.equal(0x02);
        makeAccessLevel("CurrentRead | CurrentWrite").value.should.equal(0x03);
        makeAccessLevel("CurrentWrite | CurrentRead").value.should.equal(0x03);


        AccessLevelFlag.get(0x1).key.should.eql("CurrentRead");
        AccessLevelFlag.get(0x2).key.should.eql("CurrentWrite");
        AccessLevelFlag.get(0x3).key.should.eql("CurrentRead | CurrentWrite");

        makeAccessLevel(makeAccessLevel("CurrentRead")).value.should.equal(0x01);
    });

    it("should create a flag with no bit set", function () {
        const accessLevel = makeAccessLevel("");
        accessLevel.key.should.eql("NONE");
        accessLevel.value.should.equal(AccessLevelFlag.NONE.value);
        accessLevel.has("CurrentRead").should.eql(false);
        accessLevel.has("CurrentWrite").should.eql(false);

    });
    it("should create a flag with no bit set -> 0", function () {
        const accessLevel = makeAccessLevel(0);
        accessLevel.key.should.eql("NONE");
        accessLevel.value.should.equal(AccessLevelFlag.NONE.value);
        accessLevel.has("CurrentRead").should.eql(false);
        accessLevel.has("CurrentWrite").should.eql(false);

    });
    it("should have a accessLevel Flag Basic Type", function () {
        _.isObject(findBuiltInType("AccessLevelFlag")).should.equal(true);
    });

    it("should create an object with access_level", function () {
        const o = new ObjWithAccessLevel();
        o.should.have.property("accessLevel");
        o.accessLevel.should.eql(AccessLevelFlag.get("CurrentRead | CurrentWrite"));
    });

    it("should create an object with access_level defined as a 'string'", function () {

        const o = new ObjWithAccessLevel({
            accessLevel: "HistoryWrite | SemanticChange"
        });
        o.should.have.property("accessLevel");
        o.accessLevel.should.eql(AccessLevelFlag.get("HistoryWrite | SemanticChange"));

    });

    it("should create an object with access_level defined as a Int8'", function () {

        const o = new ObjWithAccessLevel({
            accessLevel: 0x5
        });
        o.should.have.property("accessLevel");
        o.accessLevel.should.eql(AccessLevelFlag.get("CurrentRead | HistoryRead"));
    });

    it("should persist a accessLevel Flag", function () {

        const o = new ObjWithAccessLevel({});
        o.accessLevel.should.eql(AccessLevelFlag.get("CurrentRead | CurrentWrite"));

        const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/test_helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
        encode_decode_round_trip_test(o);


    });

    it("should provide a easy way to check if a flag is set or not", function () {

        const accessLevel = makeAccessLevel("CurrentWrite | CurrentRead");

        accessLevel.has("CurrentWrite").should.be.eql(true);
        accessLevel.has("CurrentRead").should.be.eql(true);
        accessLevel.has("HistoryRead").should.be.eql(false);
    });
});
