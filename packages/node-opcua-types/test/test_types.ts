import should from "should";
import * as t from "..";

describe("Testing node-opcua-test", () => {
    it("AxisInformation", () => {
        const a = new t.AxisInformation({});
    });
    it("AxisInformation", () => {
        const a = new t.ReferenceDescription({
            browseName: null
        });
        should(a.browseName.name).eql(null);
    });
});
