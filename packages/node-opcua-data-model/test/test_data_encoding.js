const { isValidDataEncoding, isDataEncoding } = require("..");
describe("DataEncoding", () => {
    it("isDataEncoding", () => {
        isDataEncoding({ name: "DefaultBinary" }).should.eql(true);
    });
    it("isValidDataEncoding", () => {
        isValidDataEncoding(null).should.eql(true);
        isValidDataEncoding({ name: "DefaultBinary" }).should.eql(true);
        isValidDataEncoding({ name: "DefaultXml" }).should.eql(true);
        isValidDataEncoding({ name: "DefaultJson" }).should.eql(true);
        isValidDataEncoding({ name: "DefaultStuff" }).should.eql(false);
        isValidDataEncoding({ name: null }).should.eql(true);
        isValidDataEncoding("DefaultBinary").should.eql(true);
        isValidDataEncoding("DefaultXml").should.eql(true);
        isValidDataEncoding("DefaultJson").should.eql(true);
        isValidDataEncoding("DefaultStuff").should.eql(false);
    });
});
