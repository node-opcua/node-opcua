const { getBuiltInType, hasBuiltInType, findBuiltInType } = require("..");
require("should");

describe("basic types: hasBuiltInType", () => {
    it("hasBuiltInType ", () => {
        hasBuiltInType("UAString").should.eql(false);
        hasBuiltInType("String").should.eql(true);
    });
});
describe("basic types: getBuiltInType", () => {
    it("should Int32 not be abstract", () => {
        const int32 = getBuiltInType("Int32");
        int32.isAbstract.should.eql(false);
    });

    it("should Number be abstract", () => {
        const number = getBuiltInType("Number");
        number.isAbstract.should.eql(true);
    });

    it("should Int32 be a Number", () => {
        const int32 = getBuiltInType("Int32");

        const number = getBuiltInType("Number");
        int32.isSubTypeOf(number).should.eql(true);
    });

    it("should String not be a Number", () => {
        const stringT = getBuiltInType("String");
        const number = getBuiltInType("Number");
        stringT.isSubTypeOf(number).should.eql(false);
    });

    it("should Image be a ByteString", () => {
        const byteString = getBuiltInType("ByteString");
        const image = getBuiltInType("Image");
        image.isSubTypeOf(byteString).should.eql(true);
    });

    it("should ImagePNG be a ByteString", () => {
        const byteString = getBuiltInType("ByteString");
        const imagePNG = getBuiltInType("ImagePNG");
        imagePNG.isSubTypeOf(byteString).should.eql(true);
    });
});

describe("findBuiltInType", () => {
    it("should findBuiltInType - String be String", () => {
        const t = findBuiltInType("String");
        t.name.should.eql("String");
        t.category.should.eql("basic");
    });

    it("should findBuiltInType - ImagePNG be ByteString ", () => {
        const t = findBuiltInType("ImagePNG");
        t.name.should.eql("ByteString");
        t.category.should.eql("basic");
    });

    it("should findBuiltInType - Number be Number ", () => {
        const t = findBuiltInType("Number");
        t.name.should.eql("Number");
        t.category.should.eql("basic");
    });

    it("should findBuiltInType - Integer be Integer ", () => {
        const t = findBuiltInType("Integer");
        t.name.should.eql("Integer");
        t.category.should.eql("basic");
        t.isAbstract.should.eql(true);
    });

    it("should findBuiltInType - Integer be UInt32 ", () => {
        const t = findBuiltInType("UInt32");
        t.name.should.eql("UInt32");
        t.category.should.eql("basic");
        t.isAbstract.should.eql(false);
    });
});
