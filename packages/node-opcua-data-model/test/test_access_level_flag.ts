import "node:path";
import "should";
import { BinaryStream } from "node-opcua-binary-stream";

import {
    AccessLevelFlag,
    accessLevelFlagToString,
    convertAccessLevelFlagToByte,
    decodeAccessLevelFlag,
    encodeAccessLevelFlag,
    makeAccessLevelFlag,
    randomAccessLevel
} from "..";

describe("Testing AccessLevelFlag", () => {
    it("should create a access level flags from a string", () => {
        makeAccessLevelFlag("CurrentRead").should.equal(0x01);
        makeAccessLevelFlag("CurrentWrite").should.equal(0x02);
        makeAccessLevelFlag("CurrentRead | CurrentWrite").should.equal(0x03);
        makeAccessLevelFlag("CurrentWrite | CurrentRead").should.equal(0x03);

        AccessLevelFlag[0x1].should.eql("CurrentRead");
        AccessLevelFlag[0x2].should.eql("CurrentWrite");
        // todo        AccessLevelFlag[0x3].should.eql("CurrentRead | CurrentWrite");

        makeAccessLevelFlag(makeAccessLevelFlag("CurrentRead")).should.equal(0x01);
    });

    it("should create a flag with no bit set", () => {
        const accessLevel = makeAccessLevelFlag("");
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);
    });
    it("should create a flag with no bit set -> 0", () => {
        const accessLevel = makeAccessLevelFlag(0);
        accessLevel.should.eql(AccessLevelFlag.NONE);
        (accessLevel & AccessLevelFlag.CurrentRead).should.eql(0);
        (accessLevel & AccessLevelFlag.CurrentWrite).should.eql(0);
    });

    it("should provide a easy way to check if a flag is set or not", () => {
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
        // 0 is the empty bitmask, which is a legitimate runtime value; the enum has
        // no 0 member (None is 0x800), so it needs to be said explicitly
        accessLevelFlagToString(0 as AccessLevelFlag).should.eql("None");
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
