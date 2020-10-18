const { isValidUInt16, isValidInt8, isValidUInt8, isValidInt16, isValidUInt32, isValidInt32 } = require("..");
describe("Integers", () => {
    it("isValidUInt16", () => {
        isValidUInt16(NaN).should.eql(false);
    })
    it("isValidInt16", () => {
        isValidInt16(NaN).should.eql(false);
    })
    it("isValidUInt32", () => {
        isValidUInt32(NaN).should.eql(false);
    })
    it("isValidInt32", () => {
        isValidInt32(NaN).should.eql(false);
    })
    it("isValidInt8", () => {
        isValidInt8(NaN).should.eql(false);

    })
    it("isValidUInt8", () => {
        isValidUInt8(NaN).should.eql(false);

    })

})