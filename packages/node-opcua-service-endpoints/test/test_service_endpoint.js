var endpoint_service = require("..");

describe("Endpoints Service",function() {

    it("should instantiate a GetEndpointsRequest",function() {

        var obj = new endpoint_service.GetEndpointsRequest();
    });

    it("should instantiate a GetEndpointsResponse",function() {

        var obj = new endpoint_service.GetEndpointsResponse();
    });
});