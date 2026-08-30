import * as service from "..";

describe("RegisterNode Service", () => {
    it("should create a RegisterNodesRequest", () => {
        new service.RegisterNodesRequest();
    });
    it("should create a RegisterNodesResponse", () => {
        new service.RegisterNodesResponse();
    });
    it("should create a UnregisterNodesRequest", () => {
        new service.UnregisterNodesRequest();
    });
    it("should create a UnregisterNodesResponse", () => {
        new service.UnregisterNodesResponse();
    });
});
