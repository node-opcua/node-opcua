import { validateLocaleId } from "../dist/index.js";

describe("validateLocaleId", () => {
    it("validateLocaleId", () => {
        validateLocaleId("en").should.eql(true);
        validateLocaleId(null).should.eql(true);
    });
});
