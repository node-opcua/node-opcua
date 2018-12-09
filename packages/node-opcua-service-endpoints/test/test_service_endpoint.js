const endpoint_service = require("..");

describe("Endpoints Service",function() {

    it("should instantiate a GetEndpointsRequest",function() {

        const obj = new endpoint_service.GetEndpointsRequest();
    });

    it("should instantiate a GetEndpointsResponse",function() {

        const obj = new endpoint_service.GetEndpointsResponse();
    });
});