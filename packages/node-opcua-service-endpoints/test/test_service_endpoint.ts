import * as endpoint_service from "../dist/index.js";

describe("Endpoints Service", () => {
    it("should instantiate a GetEndpointsRequest", () => {
        const _obj = new endpoint_service.GetEndpointsRequest();
    });

    it("should instantiate a GetEndpointsResponse", () => {
        const _obj = new endpoint_service.GetEndpointsResponse();
    });
});
