const should = require("should");
const { coerceBoolean, coerceByteString, coerceUInt32, coerceInt32, coerceUInt64, coerceInt64 } = require("..");

const ec = require("..");

describe("ByteString", () => {
    it("coerceByteString with an array of integer", () => {
        coerceByteString([1, 2, 3]).toString("hex").should.eql("010203");
    });
    it("coerceByteString with base64 string", () => {
        coerceByteString(Buffer.from([1, 2, 3]).toString("base64"))
            .toString("hex")
            .should.eql("010203");
    });
    it("coerceByteString with a Buffer", () => {
        coerceByteString(Buffer.from([1, 2, 3]))
            .toString("hex")
            .should.eql("010203");
    });
});
describe("coerceUInt32", () => {
    it("coerceUInt32 number", () => {
        coerceUInt32(1).should.eql(1);
    });
    it("coerceUInt32 number", () => {
        coerceUInt32("123").should.eql(123);
    });
    it("coerceUInt32 number", () => {
        coerceUInt32({ value: 56 }).should.eql(56);
    });
});
describe("coerceInt32", () => {
    it("coerceInt32 number", () => {
        coerceInt32(1).should.eql(1);
    });
    it("coerceInt32 number", () => {
        coerceInt32("123").should.eql(123);
    });
    it("coerceInt32 number", () => {
        coerceInt32([0, 56]).should.eql(56);
    });
});
describe("coerceUInt64", () => {
    it("should coerce an Int32 into Int64", () => {
        coerceUInt64(0xff1000).should.eql([0x0, 0xff1000]);
    });
    it("should coerce an long number into Int64", () => {
        coerceUInt64(0x1020000000).should.eql([0x10, 0x20000000]);
    });
    it("should coerce an long number into Int64", () => {
        coerceUInt64(0x100020000000).should.eql([0x1000, 0x20000000]);
    });

    [
        [1, [0x0, 0x1]],
        [-1, [0xffffffff, 0xffffffff]],
        [-2, [0xffffffff, 0xfffffffe]],
        ["1", [0x0, 0x1]],
        ["-1", [0xffffffff, 0xffffffff]],
        ["-2", [0xffffffff, 0xfffffffe]],
        ["0x1000000000", [0x10, 0x0]],
        ["-100000000000000", [4294944012, 4018520064]],
    ].forEach(([input, output]) =>
        it(`should coerce ${typeof input}:${input} number  into ${output.map((a) => a.toString(16)).join(",")}`, () => {
            coerceInt64(input).should.eql(output);
        })
    );
});
describe("check coerce various types", () => {
    //
    //        "String",
    //        "Boolean",
    //        "Double",
    //        "Float",
    //        "Guid",
    //        "DateTime",
    //        "NodeId",
    //        "ByteString",

    it("should have a coerce method for boolean", () => {
        coerceBoolean("false").should.equal(false);
        coerceBoolean("true").should.equal(true);

        coerceBoolean(0).should.equal(false);
        coerceBoolean(1).should.equal(true);

        coerceBoolean(false).should.equal(false);
        coerceBoolean(true).should.equal(true);

        coerceBoolean("0").should.equal(false);
        coerceBoolean("1").should.equal(true);
    });

    const types = ["Byte", "SByte", "UInt8", "UInt16", "UInt32", "Int8", "Int16", "Int32", "Float", "Double", "Int64", "UInt64"];

    types.forEach(function (type) {
        it("should have a coerce method for " + type, () => {
            const coerceFunc = ec["coerce" + type];
            const randomFunc = ec["random" + type];
            //xx var isValidFunc = ec["isValid" + type];

            ec.should.have.property("coerce" + type);
            ec.should.have.property("random" + type);
            ec.should.have.property("isValid" + type);

            const random_value = randomFunc();

            const value1 = coerceFunc(random_value);
            value1.should.eql(random_value);

            const value2 = coerceFunc(random_value.toString());
            value2.should.eql(random_value);
        });
    });

    function w(str, l) {
        return (str + "                        ").substring(0, l);
    }

    types.forEach((type) => {
        it("coerce" + w(type, 8) + " should preserves null or undefined values ", () => {
            const coerceFunc = ec["coerce" + type];

            ec.should.have.property("coerce" + type);

            const value1 = coerceFunc(null);
            if (value1 instanceof Array) {
                value1.should.eql([0, 0]);
            } else {
                value1.should.eql(0);
            }
            const value2 = coerceFunc();
            if (value2 instanceof Array) {
                value2.should.eql([0, 0]);
            } else {
                value2.should.eql(0);
            }
        });
    });
});
