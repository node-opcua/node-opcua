import "should";

import * as endpoints_service from "../dist/index.js";

const GetEndpointsRequest = endpoints_service.GetEndpointsRequest;
const GetEndpointsResponse = endpoints_service.GetEndpointsResponse;

describe(" EndPoint Service", () => {
    it(" should create a GetEndPointRequest", () => {
        const endpointRequest = new GetEndpointsRequest();

        endpointRequest.should.have.property("requestHeader");
        endpointRequest.should.have.property("endpointUrl");
        endpointRequest.should.have.property("localeIds");
        endpointRequest.should.have.property("profileUris");

        endpointRequest.localeIds!.should.be.instanceOf(Array);
        endpointRequest.profileUris!.should.be.instanceOf(Array);
    });

    it(" should create a GetEndPointResponse", () => {
        const _endpointResponse = new GetEndpointsResponse();
    });
});
