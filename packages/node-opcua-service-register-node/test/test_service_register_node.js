"use strict";
var service = require("..");
describe("RegisterNode Service",function() {

    it("should create a RegisterNodesRequest",function() {
        new service.RegisterNodesRequest();
    });
    it("should create a RegisterNodesResponse",function() {
        new service.RegisterNodesResponse();
    });
    it("should create a UnregisterNodesRequest",function() {
        new service.UnregisterNodesRequest();
    });
    it("should create a UnregisterNodesResponse",function() {
        new service.UnregisterNodesResponse();
    });

});