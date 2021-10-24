const should = require("should");
const { ReadValueId } = require(".."); // node-opcua-types"

describe("Issue 688", () => {
    it("should throw an exception when argument of ReadValueId are invalid", () => {
        should(() => {
            const r = new ReadValueId({
                nodeId: "someError" // << this invalid node id should cause a exception !
            });
        }).throw("String cannot be coerced to a nodeId : someError");
    });
    it("should coerce a ReadValueId", () => {
        should(() => {
            const r = new ReadValueId({
                nodeId: "ns=1;s=OK" // << this  node id should cause a exception !
            });
        }).not.throw();
    });
});
