import "should";

import { makeNodeClassMask } from "..";

describe("testing makeNodeClassMask", () => {
    it("should provide a way to build a NodeClassMask easily", () => {
        const mask = makeNodeClassMask("Object | ObjectType");
        mask.should.eql(1 + (1 << 3));
    });
});
