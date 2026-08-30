import { isValidInt8, isValidInt16, isValidInt32, isValidUInt8, isValidUInt16, isValidUInt32 } from "..";

describe("Integers", () => {
    it("isValidUInt16", () => {
        isValidUInt16(NaN).should.eql(false);
    });
    it("isValidInt16", () => {
        isValidInt16(NaN).should.eql(false);
    });
    it("isValidUInt32", () => {
        isValidUInt32(NaN).should.eql(false);
    });
    it("isValidInt32", () => {
        isValidInt32(NaN).should.eql(false);
    });
    it("isValidInt8", () => {
        isValidInt8(NaN).should.eql(false);
    });
    it("isValidUInt8", () => {
        isValidUInt8(NaN).should.eql(false);
    });
});
