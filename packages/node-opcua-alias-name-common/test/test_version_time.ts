import should from "should";
import {
    VERSION_TIME_EPOCH_MS,
    VERSION_TIME_WRAP_DATE,
    fromVersionTime,
    maxVersionTime,
    nowVersionTime,
    toVersionTime
} from "../source";

/**
 * OPC 10000-4 clause 7.43 (`VersionTime`), as used by OPC 10000-17
 * clause 6.3.1 for `LastChange`.
 *
 * A UInt32 count of *seconds since 2000-01-01T00:00:00Z*. Not a DateTime.
 */
describe("OPC 10000-17: VersionTime helpers", () => {
    describe("the epoch", () => {
        it("should place the epoch at 2000-01-01T00:00:00Z", () => {
            new Date(VERSION_TIME_EPOCH_MS).toISOString().should.eql("2000-01-01T00:00:00.000Z");
        });

        it("should map the epoch itself to 0", () => {
            toVersionTime(new Date("2000-01-01T00:00:00.000Z")).should.eql(0);
        });

        it("should map one second after the epoch to 1", () => {
            toVersionTime(new Date("2000-01-01T00:00:01.000Z")).should.eql(1);
        });

        it("should clamp instants before the epoch to 0 rather than wrapping", () => {
            // a negative count is not representable; wrapping it would look to a
            // client like a version far in the future
            toVersionTime(new Date("1999-12-31T23:59:59.000Z")).should.eql(0);
            toVersionTime(new Date("1970-01-01T00:00:00.000Z")).should.eql(0);
        });

        it("should round trip the epoch", () => {
            fromVersionTime(0).toISOString().should.eql("2000-01-01T00:00:00.000Z");
        });
    });

    describe("one second resolution", () => {
        it("should truncate sub-second precision rather than rounding up", () => {
            // rounding up would name an instant that has not happened yet
            toVersionTime(new Date("2000-01-01T00:00:01.999Z")).should.eql(1);
            toVersionTime(new Date("2000-01-01T00:00:00.001Z")).should.eql(0);
        });

        it("should give two changes within the same second the same value", () => {
            const a = toVersionTime(new Date("2024-06-01T12:00:00.100Z"));
            const b = toVersionTime(new Date("2024-06-01T12:00:00.900Z"));
            a.should.eql(b);
        });

        it("should lose the sub-second part on a round trip", () => {
            const date = new Date("2024-06-01T12:00:00.750Z");
            fromVersionTime(toVersionTime(date)).toISOString().should.eql("2024-06-01T12:00:00.000Z");
        });
    });

    describe("known values", () => {
        it("should convert a whole day after the epoch", () => {
            toVersionTime(new Date("2000-01-02T00:00:00.000Z")).should.eql(86400);
        });

        it("should round trip an arbitrary instant to the second", () => {
            const date = new Date("2026-08-07T16:47:15.000Z");
            fromVersionTime(toVersionTime(date)).getTime().should.eql(date.getTime());
        });

        it("should accept a millisecond number as well as a Date", () => {
            const date = new Date("2024-01-01T00:00:00.000Z");
            toVersionTime(date.getTime()).should.eql(toVersionTime(date));
        });

        it("should produce a plausible value for now", () => {
            const value = nowVersionTime();
            value.should.be.above(0);
            value.should.be.below(0x1_0000_0000);
            Number.isInteger(value).should.eql(true);
        });
    });

    describe("UInt32 wraparound in 2136", () => {
        it("should wrap at 2**32 seconds after the epoch", () => {
            VERSION_TIME_WRAP_DATE.toISOString().should.eql("2136-02-07T06:28:16.000Z");
        });

        it("should hold the largest UInt32 one second before the wrap", () => {
            const oneSecondBefore = new Date(VERSION_TIME_WRAP_DATE.getTime() - 1000);
            toVersionTime(oneSecondBefore).should.eql(0xffff_ffff);
        });

        it("should wrap back to 0 at the wrap instant", () => {
            toVersionTime(VERSION_TIME_WRAP_DATE).should.eql(0);
        });

        it("should wrap to 1 one second past the wrap instant", () => {
            toVersionTime(new Date(VERSION_TIME_WRAP_DATE.getTime() + 1000)).should.eql(1);
        });

        it("should always stay within UInt32", () => {
            for (const date of [
                new Date("2000-01-01T00:00:00Z"),
                new Date("2100-01-01T00:00:00Z"),
                new Date("2136-02-07T06:28:15Z"),
                new Date("2200-01-01T00:00:00Z"),
                new Date("3000-01-01T00:00:00Z")
            ]) {
                const value = toVersionTime(date);
                value.should.be.aboveOrEqual(0);
                value.should.be.below(0x1_0000_0000);
                Number.isInteger(value).should.eql(true);
            }
        });
    });

    describe("fromVersionTime input validation", () => {
        it("should reject a value outside UInt32", () => {
            should(() => fromVersionTime(-1)).throw(RangeError);
            should(() => fromVersionTime(0x1_0000_0000)).throw(RangeError);
        });

        it("should reject a non-integer", () => {
            should(() => fromVersionTime(1.5)).throw(RangeError);
        });

        it("should accept both UInt32 bounds", () => {
            fromVersionTime(0).should.be.instanceOf(Date);
            fromVersionTime(0xffff_ffff).should.be.instanceOf(Date);
        });
    });

    describe("toVersionTime input validation", () => {
        it("should reject an invalid Date", () => {
            should(() => toVersionTime(new Date("not a date"))).throw(TypeError);
            should(() => toVersionTime(Number.NaN)).throw(TypeError);
        });
    });

    describe("maxVersionTime (the clause 6.3.1 rollup)", () => {
        it("should return the later of two values", () => {
            maxVersionTime(10, 20).should.eql(20);
            maxVersionTime(20, 10).should.eql(20);
            maxVersionTime(10, 10).should.eql(10);
        });

        it("should be usable to roll descendants up into an ancestor", () => {
            const descendants = [100, 350, 42];
            descendants.reduce(maxVersionTime, 0).should.eql(350);
        });
    });
});
