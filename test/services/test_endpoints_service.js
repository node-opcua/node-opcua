
var should = require("should");


var endpoints_service = require("../../lib/services/get_endpoints_service");
var GetEndpointsRequest = endpoints_service.GetEndpointsRequest;
var GetEndpointsResponse = endpoints_service.GetEndpointsResponse;
var EndpointDescription = endpoints_service.EndpointDescription;

describe(" EndPoint Service",function()
{
    it(" should create a GetEndPointRequest",function()
    {
       var endpointRequest = new GetEndpointsRequest();

       endpointRequest.should.have.property("requestHeader");
       endpointRequest.should.have.property("endpointUrl");
       endpointRequest.should.have.property("localeIds");
       endpointRequest.should.have.property("profileUris");

       endpointRequest.localeIds.should.be.instanceOf(Array);
       endpointRequest.profileUris.should.be.instanceOf(Array);

    });

    it(" should create a GetEndPointResponse",function()
    {

        var endpointResponse = new GetEndpointsResponse();

    });
    it(" should create a EndpointDescription",function()
    {

        var endpointDescription = new EndpointDescription();


    });
});