import should from "should";
import { ReadValueId } from "../dist/index.js"; // node-opcua-types"

describe("Issue 688", () => {
    it("should throw an exception when argument of ReadValueId are invalid", () => {
        should(() => {
            const _r = new ReadValueId({
                nodeId: "someError" // << this invalid node id should cause a exception !
            });
        }).throw("String cannot be coerced to a nodeId : someError");
    });
    it("should coerce a ReadValueId", () => {
        should(() => {
            const _r = new ReadValueId({
                nodeId: "ns=1;s=OK" // << this  node id should cause a exception !
            });
        }).not.throw();
    });
});
