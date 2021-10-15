const path = require("path");
const should = require("should");
const { assert } = require("node-opcua-assert");
const { BinaryStream } = require("node-opcua-binary-stream");
const { findBuiltInType } = require("node-opcua-factory");

const {
    convertAccessLevelFlagToByte,
    AccessLevelFlag,
    makeAccessLevelFlag,
    accessLevelFlagToString,
    randomAccessLevel,
    encodeAccessLevelFlag,
    decodeAccessLevelFlag
} = require("..");

describe("Testing AccessLevelFlag", function () {
    it("should create a access level flags from a string", function () {
        makeAccessLevelFlag("CurrentRead").should.equal(0x01);
        makeAccessLevelFlag("CurrentWrite").should.equal(0x02);
        makeAccessLevelFlag("CurrentRead | CurrentWrite").should.equal(0x03);
        makeAccessLevelFlag("CurrentWrite | CurrentRead").should.equal(0x03);

        AccessLevelFlag[0x1].should.eql("CurrentRead");
        AccessLevelFlag[0x2].should.eql("CurrentWrite");
        // todo        AccessLevelFlag[0x3].should.eql("CurrentRead | CurrentWrite");

        makeAccessLevelFlag(makeAccessLevelFlag("CurrentRead")).should.equal(0x01);
    });

    it("should create a flag with no bit set", function () {
        const accessLevel = makeAccessLevelFlag("");
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);
    });
    it("should create a flag with no bit set -> 0", function () {
        const accessLevel = makeAccessLevelFlag(0);
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);
    });
    it("should have a accessLevel Flag Basic Type", function () {
        (findBuiltInType("AccessLevelFlag") !== null && typeof findBuiltInType("AccessLevelFlag") === "object").should.equal(true);
    });

    it("should provide a easy way to check if a flag is set or not", function () {
        const accessLevel = makeAccessLevelFlag("CurrentWrite | CurrentRead");
        (accessLevel & AccessLevelFlag.CurrentWrite).should.be.eql(AccessLevelFlag.CurrentWrite);
        (accessLevel & AccessLevelFlag.CurrentRead).should.be.eql(AccessLevelFlag.CurrentRead);
        (accessLevel & AccessLevelFlag.HistoryRead).should.be.eql(0);
    });

    it("convertAccessLevelFlagToByte", () => {
        convertAccessLevelFlagToByte(AccessLevelFlag.CurrentRead).should.eql(1);
        convertAccessLevelFlagToByte(AccessLevelFlag.CurrentRead | AccessLevelFlag.CurrentWrite).should.eql(3);
    });
    it("accessLevelFlagToString", () => {
        accessLevelFlagToString(AccessLevelFlag.HistoryRead).should.eql("HistoryRead");
        accessLevelFlagToString(AccessLevelFlag.HistoryRead | AccessLevelFlag.CurrentRead).should.eql("CurrentRead | HistoryRead");
        accessLevelFlagToString(0x3f | AccessLevelFlag.TimestampWrite).should.eql(
            "CurrentRead | CurrentWrite | StatusWrite | TimestampWrite | HistoryRead | HistoryWrite | SemanticChange"
        );
        accessLevelFlagToString(0).should.eql("None");
    });
    it("randomAccessLevel", () => {
        const flag = randomAccessLevel();
        const str = accessLevelFlagToString(flag);
        const checked = makeAccessLevelFlag(str);
        checked.should.eql(flag);
    });

    it("encode/decode", () => {
        const stream = new BinaryStream();
        const flag = randomAccessLevel();

        encodeAccessLevelFlag(flag, stream);

        stream.rewind();
        const verify = decodeAccessLevelFlag(stream);
        verify.should.eql(flag);
    });
});
