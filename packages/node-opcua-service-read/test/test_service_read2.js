"use strict";
var Read_service = require("..");

describe("Read Service",function() {


    it("should create a ReadValueId",function() {
        new Read_service.ReadValueId({});
    });
    it("should create a ReadRequest",function() {
        new Read_service.ReadRequest({});
    });
    it("should create a ReadResponse",function() {
        new Read_service.ReadResponse({});
    });
});