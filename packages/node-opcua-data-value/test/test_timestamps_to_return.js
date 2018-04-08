"use strict";
const rs = require("..");
const should = require("should");

describe("TimestampsToReturn", function () {

    it("should create an invalid timestampsToReturn", function () {

        let v = rs.TimestampsToReturn.get(1000);
        should.not.exist(v);
        v = rs.TimestampsToReturn.get(0x03);
        should(v).eql(rs.TimestampsToReturn.Neither);

    });
});

