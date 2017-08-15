"use strict";
var rs = require("..");
var should = require("should");

describe("TimestampsToReturn", function () {

    it("should create an invalid timestampsToReturn", function () {

        var v = rs.TimestampsToReturn.get(1000);
        should.not.exist(v);
        v = rs.TimestampsToReturn.get(0x03);
        should(v).eql(rs.TimestampsToReturn.Neither);

    });
});

