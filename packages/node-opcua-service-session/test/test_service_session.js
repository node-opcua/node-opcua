const should = require("should");
const service = require("..");


const ApplicationDescription = require("node-opcua-service-endpoints").ApplicationDescription;
const ApplicationType = require("node-opcua-service-endpoints").ApplicationType;
const CreateSessionRequest = service.CreateSessionRequest;

describe("Session Service",function() {

    it("should instantiate a CreateSessionRequest",function() {
        const obj = new service.CreateSessionRequest();
    });
    it("should instantiate a CreateSessionResponse",function() {
        const obj = new service.CreateSessionResponse();
    });

    it("should instantiate a ActivateSessionRequest",function() {
        const obj = new service.ActivateSessionRequest();
    });
    it("should instantiate a ActivateSessionResponse",function() {
        const obj = new service.ActivateSessionResponse();
    });


    it("should create a complex type with embedded type", function () {

        const applicationDescription = new ApplicationDescription({
            applicationUri: "application:uri",
            productUri: "uri:product",
            applicationName: {text: "MyApplication"},
            applicationType: ApplicationType.CLIENT,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });


        const request = new CreateSessionRequest({
            clientDescription: applicationDescription,
            serverUri: "serverUri",
            endpointUrl: "endpointUrl",
            sessionName: "sessionName",
            clientNonce: new Buffer("_clientNonce"),
            clientCertificate: undefined,
            requestedSessionTimeout: 300000,
            maxResponseMessageSize: 800000
        });

        request.clientDescription.applicationUri.should.equal("application:uri");
        request.clientDescription.productUri.should.equal("uri:product");
        request.clientDescription.applicationName.text.should.equal("MyApplication");
        request.clientDescription.applicationType.should.equal(ApplicationType.CLIENT);
        request.clientDescription.discoveryUrls.length.should.equal(0);


    });

});

