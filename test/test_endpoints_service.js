
var should = require("should");
var s = require("../lib/structures");


describe(" EndPoint Service",function()
{
    it(" should create a GetEndPointRequest",function()
    {
       var endpointRequest = new s.GetEndpointsRequest();

       endpointRequest.should.have.property("requestHeader");
       endpointRequest.should.have.property("endpointUrl");
       endpointRequest.should.have.property("localeIds");
       endpointRequest.should.have.property("profileUris");

       endpointRequest.localeIds.should.be.instanceOf(Array);
       endpointRequest.profileUris.should.be.instanceOf(Array);

    });

    it(" should create a GetEndPointResponse",function()
    {

        var endpointResponse = new s.GetEndpointsResponse();

    });
    it(" should create a EndpointDescription",function()
    {

        var endpointDescription = new s.EndpointDescription();


    });
});