import { makeResultMask, ResultMask } from "../dist/index.js";

describe("ResultMask", () => {
    it("makeResultMask", () => {
        makeResultMask("NodeClass").should.eql(ResultMask.NodeClass);
        makeResultMask("NodeClass | ReferenceType").should.eql(ResultMask.NodeClass + ResultMask.ReferenceType);
    });
});
