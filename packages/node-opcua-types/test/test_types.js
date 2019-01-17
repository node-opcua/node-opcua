"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const t = require("..");
const should = require("should");
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
//# sourceMappingURL=test_types.js.map