"use strict";
require("should");

var makeNodeClassMask = require("..").makeNodeClassMask;

describe("testing makeNodeClassMask", function () {

    it("should provide a way to build a NodeClassMask easily", function () {

        var mask = makeNodeClassMask("Object | ObjectType");
        mask.should.eql(1 + (1 << 3));

    });
});
