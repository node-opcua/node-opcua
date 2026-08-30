const should = require("should");

const { assert } = require("node-opcua-assert");

// How to deal with UInt64 and UInt32 with only Int32 !

// https://google.github.io/closure-library/api/goog.math.Long.html

function Int64_add(a, b) {
    assert(a[0] >= 0 && a[0] <= 0xffffffff);
    assert(a[1] >= 0 && a[1] <= 0xffffffff);
    const low = (a[1] + b[1]) & 0xffffffff;
    let carry = 0;
    if (low < a[1] || low < b[1]) {
        carry = 1;
    }
    const high = a[0] + b[0] + carry;
    return [high, low];
}
function Int64_mul2(a) {
    assert(a[0] >= 0 && a[0] <= 0xffffffff);
    assert(a[1] >= 0 && a[1] <= 0xffffffff);
    const low = (a[1] << 1) & 0xffffffff;
    let carry = 0;
    if (low < a[1]) {
        carry = 1;
    }
    const high = (a[0] << 1) + carry;
    return [high, low];
}
function numberTo64(value) {
    const negative = value < 0 ? true : false;

    if (negative) value *= -1;
    let result = [(value / 0x100000000) & 0xffffffff, value & 0xffffffff];

    if (negative) {
        result = [result[0] ^ 0xffffffff, result[1] ^ 0xffffffff];
    }
    return result;
}
function int64ToNumber(int64) {
    return int64[0] * 0x100000000 + int64[1];
}
xdescribe("Int64 Arithmetic", function () {
    it("should convert a positive number to Int64", function () {
        numberTo64(0xa12345678).should.eql([0xa, 0x12345678]);
    });

    it("should convert a negative number to Int64", function () {
        numberTo64(-1).should.eql([0xffffffff, 0xffffffff]);
    });

    it("should convert a  positive number to Int64", function () {
        numberTo64(0xabc12345678).should.eql([0xabc, 0x12345678]);
    });
    it("should convert a Int64 to number", function () {
        int64ToNumber([0xabc, 0x12345678]).should.eql(0xabc12345678);
    });

    it("should add two 64 bits  values", function () {
        // A= 10
        // Ah + Ab = 14h
        const a = [0x0000001, 0xa0000000];
        const b = [0x0000001, 0xa0000000];

        const s = Int64_add(a, b);

        s.should.eql([0x00000003, 0x40000000]);
    });

    it("should add two 64 bits  values", function () {
        const a = [0x0000001, 0xffffffff];
        const b = [0x0000001, 0x00000002];

        const s = Int64_add(a, b);

        s.should.eql([0x00000003, 0x00000001]);
    });
    it("should double two 64 bits  values", function () {
        const a = [0x0000001, 0x80000000];
        const s = Int64_mul2(a);
        s.should.eql([0x00000003, 0x00000000]);
    });

    it("should double two 64 bits  values", function () {
        const a = [0x0000001, 0x80000000];
        const s = Int64_mul2(a);
        s.should.eql([0x00000003, 0x00000000]);
    });
});
