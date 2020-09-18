const should = require("should");
const { assert } = require("node-opcua-assert");
const _ = require("underscore");
const path = require("path");

const AccessLevelFlag = require("..").AccessLevelFlag;
const makeAccessLevelFlag = require("..").makeAccessLevelFlag;
const findBuiltInType = require("node-opcua-factory").findBuiltInType;

describe("Testing AccessLevelFlag", function() {

    it("should create a access level flags from a string", function() {

        makeAccessLevelFlag("CurrentRead").should.equal(0x01);
        makeAccessLevelFlag("CurrentWrite").should.equal(0x02);
        makeAccessLevelFlag("CurrentRead | CurrentWrite").should.equal(0x03);
        makeAccessLevelFlag("CurrentWrite | CurrentRead").should.equal(0x03);

        AccessLevelFlag[0x1].should.eql("CurrentRead");
        AccessLevelFlag[0x2].should.eql("CurrentWrite");
        // todo        AccessLevelFlag[0x3].should.eql("CurrentRead | CurrentWrite");

        makeAccessLevelFlag(makeAccessLevelFlag("CurrentRead")).should.equal(0x01);
    });

    it("should create a flag with no bit set", function() {
        const accessLevel = makeAccessLevelFlag("");
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);

    });
    it("should create a flag with no bit set -> 0", function() {
        const accessLevel = makeAccessLevelFlag(0);
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);

    });
    it("should have a accessLevel Flag Basic Type", function() {
        _.isObject(findBuiltInType("AccessLevelFlag")).should.equal(true);
    });

    it("should provide a easy way to check if a flag is set or not", function() {
        const accessLevel = makeAccessLevelFlag("CurrentWrite | CurrentRead");
        (accessLevel & AccessLevelFlag.CurrentWrite).should.be.eql(AccessLevelFlag.CurrentWrite);
        (accessLevel & AccessLevelFlag.CurrentRead).should.be.eql(AccessLevelFlag.CurrentRead);
        (accessLevel & AccessLevelFlag.HistoryRead).should.be.eql(0);
    });
});



if (false) {
    const generator = require("node-opcua-generator");
    const tmpfolder = path.join(__dirname, "../_test_generated");
    const ObjWithAccessLevel = generator.registerObject(path.join(__dirname, "fixture_schemas") + "|ObjWithAccessLevel", tmpfolder);
    assert(typeof ObjWithAccessLevel === "function");
    describe("TestAccessFlag inside object", function() {
        it("should create an object with access_level", function() {
            const o = new ObjWithAccessLevel();
            o.should.have.property("accessLevel");
            o.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);
        });

        it("should create an object with access_level defined as a 'string'", function() {

            const o = new ObjWithAccessLevel({
                accessLevel: "HistoryWrite | SemanticChange"
            });
            o.should.have.property("accessLevel");
            o.accessLevel.should.eql(AccessLevelFlag.HistoryWrite | AccessLevelFlag.SemanticChange);

        });

        it("should create an object with access_level defined as a Int8'", function() {

            const o = new ObjWithAccessLevel({
                accessLevel: 0x5
            });
            o.should.have.property("accessLevel");
            o.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.HistoryRead);
        });

        it("should persist a accessLevel Flag", function() {

            const o = new ObjWithAccessLevel({});
            o.accessLevel.should.eql(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite);

            const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;
            encode_decode_round_trip_test(o);


        });
    });
}
