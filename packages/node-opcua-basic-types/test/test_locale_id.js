const { validateLocaleId } = require("..");
describe("validateLocaleId", () => {

    it("validateLocaleId", () => {
        validateLocaleId("en").should.eql(true);
        validateLocaleId(null).should.eql(true);
    });

});