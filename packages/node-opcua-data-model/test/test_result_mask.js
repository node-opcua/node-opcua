const { makeResultMask, ResultMask } = require("..");
describe("ResultMask", () => {
    it("makeResultMask", () => {
        makeResultMask("NodeClass").should.eql(ResultMask.NodeClass);
        makeResultMask("NodeClass | ReferenceType").should.eql(ResultMask.NodeClass + ResultMask.ReferenceType);
    });
});
