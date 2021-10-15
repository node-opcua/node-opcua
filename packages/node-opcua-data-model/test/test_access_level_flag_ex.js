const { findBuiltInType } = require("node-opcua-factory");
const { BinaryStream } = require("node-opcua-binary-stream");

const {
    convertAccessLevelEFlagToByte,
    AccessLevelExFlag,
    makeAccessLevelExFlag,
    accessLevelExFlagToString,
    randomAccessLevelEx,
    encodeAccessLevelExFlag,
    decodeAccessLevelExFlag
} = require("..");

describe("Testing AccessLevelExFlag", function () {
    it("should create a access level extended flags from a string", function () {
        makeAccessLevelExFlag(0).should.eql(AccessLevelExFlag.None);
        makeAccessLevelExFlag("").should.eql(AccessLevelExFlag.None);

        makeAccessLevelExFlag("CurrentRead").should.equal(0x01);
        makeAccessLevelExFlag("CurrentWrite").should.equal(0x02);
        makeAccessLevelExFlag("CurrentRead | CurrentWrite").should.equal(0x03);
        makeAccessLevelExFlag("CurrentWrite | CurrentRead").should.equal(0x03);

        makeAccessLevelExFlag("CurrentWrite | CurrentRead | NonatomicRead").should.equal(
            AccessLevelExFlag.CurrentRead + AccessLevelExFlag.CurrentWrite + AccessLevelExFlag.NonatomicRead
        );
        makeAccessLevelExFlag("NonatomicWrite | WriteFullArrayOnly | NonatomicRead").should.equal(
            AccessLevelExFlag.NonatomicWrite + AccessLevelExFlag.WriteFullArrayOnly + AccessLevelExFlag.NonatomicRead
        );

        makeAccessLevelExFlag("NoSubDataTypes").should.equal(AccessLevelExFlag.NoSubDataTypes);
        makeAccessLevelExFlag("WriteFullArrayOnly").should.equal(AccessLevelExFlag.WriteFullArrayOnly);

        AccessLevelExFlag[0x1].should.eql("CurrentRead");
        AccessLevelExFlag[0x2].should.eql("CurrentWrite");
        AccessLevelExFlag[256].should.eql("NonatomicWrite");

        makeAccessLevelExFlag(makeAccessLevelExFlag("CurrentRead")).should.equal(0x01);
        makeAccessLevelExFlag(makeAccessLevelExFlag("NoSubDataTypes")).should.equal(AccessLevelExFlag.NoSubDataTypes);
    });

    it("should have a accessLevel Flag Basic Type", function () {
        (findBuiltInType("AccessLevelExFlag") !== null && typeof findBuiltInType("AccessLevelExFlag") === "object").should.equal(
            true
        );
    });

    it("should provide a easy way to check if a flag is set or not", function () {
        const accessLevel = makeAccessLevelExFlag("CurrentWrite | CurrentRead");
        (accessLevel & AccessLevelExFlag.CurrentWrite).should.be.eql(AccessLevelExFlag.CurrentWrite);
        (accessLevel & AccessLevelExFlag.CurrentRead).should.be.eql(AccessLevelExFlag.CurrentRead);
        (accessLevel & AccessLevelExFlag.HistoryRead).should.be.eql(0);
    });

    it("accessLevelExFlagToString", () => {
        accessLevelExFlagToString(AccessLevelExFlag.HistoryRead).should.eql("HistoryRead");
        accessLevelExFlagToString(AccessLevelExFlag.HistoryRead | AccessLevelExFlag.CurrentRead).should.eql(
            "CurrentRead | HistoryRead"
        );
        accessLevelExFlagToString(0x3f | AccessLevelExFlag.TimestampWrite).should.eql(
            "CurrentRead | CurrentWrite | StatusWrite | TimestampWrite | HistoryRead | HistoryWrite | SemanticChange"
        );
        accessLevelExFlagToString(0).should.eql("None");
        accessLevelExFlagToString(AccessLevelExFlag.WriteFullArrayOnly).should.eql("WriteFullArrayOnly");
        accessLevelExFlagToString(
            AccessLevelExFlag.NoSubDataTypes | AccessLevelExFlag.NonatomicWrite | AccessLevelExFlag.NonatomicRead
        ).should.eql("NonatomicRead | NonatomicWrite | NoSubDataTypes");
    });
    it("randomAccessLevel", () => {
        const flag = randomAccessLevelEx();
        const str = accessLevelExFlagToString(flag);
        const checked = makeAccessLevelExFlag(str);
        checked.should.eql(flag);
    });

    it("encode/decode", () => {
        const stream = new BinaryStream();
        const flag = randomAccessLevelEx();

        encodeAccessLevelExFlag(flag, stream);

        stream.rewind();
        const verify = decodeAccessLevelExFlag(stream);
        verify.should.eql(flag);
    });
});
