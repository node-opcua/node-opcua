import "should";
import { randomInt8, randomInt16, randomInt32, randomUInt8, randomUInt16, randomUInt32 } from "..";

// The maxima cannot be reached by sampling — over 2^32 values the expected maximum of
// 200000 draws still falls ~21000 short. Drive Math.random to each end of its own
// [0, 1[ range instead: exact, instant, and it fails on the old exclusive bounds.
describe("random<Type> - both ends of each integer type must be reachable", () => {
    const realRandom = Math.random;
    afterEach(() => {
        Math.random = realRandom;
    });

    it("RR-1 should produce the maximum of the type", () => {
        Math.random = () => 1 - Number.EPSILON / 2; // the largest double below 1
        randomUInt8().should.eql(0xff);
        randomInt8().should.eql(0x7f); // was 125: the old bounds were (-0x7f, 0x7e)
        randomUInt16().should.eql(0xffff);
        randomInt16().should.eql(0x7fff);
        randomUInt32().should.eql(0xffffffff);
        randomInt32().should.eql(0x7fffffff);
    });

    it("RR-2 should produce the minimum of the type", () => {
        Math.random = () => 0;
        randomUInt8().should.eql(0x00);
        randomInt8().should.eql(-0x80); // was -127
        randomUInt16().should.eql(0x0000);
        randomInt16().should.eql(-0x8000);
        randomUInt32().should.eql(0x00000000);
        randomInt32().should.eql(-0x80000000);
    });
});
