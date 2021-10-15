"use strict";
require("should");

const { makeNodeClassMask } = require("..");

describe("testing makeNodeClassMask", function () {
    it("should provide a way to build a NodeClassMask easily", function () {
        const mask = makeNodeClassMask("Object | ObjectType");
        mask.should.eql(1 + (1 << 3));
    });
});
