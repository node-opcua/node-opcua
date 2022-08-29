const should = require("should");

const { ApplicationDescription, ApplicationType } = require("node-opcua-service-endpoints");
const { CreateSessionRequest, CreateSessionResponse, ActivateSessionRequest, ActivateSessionResponse } = require("..");

describe("Session Service", function () {
    it("should instantiate a CreateSessionRequest", function () {
        const obj = new CreateSessionRequest();
    });
    it("should instantiate a CreateSessionResponse", function () {
        const obj = new CreateSessionResponse();
    });

    it("should instantiate a ActivateSessionRequest", function () {
        const obj = new ActivateSessionRequest();
    });
    it("should instantiate a ActivateSessionResponse", function () {
        const obj = new ActivateSessionResponse();
    });

    it("should create a complex type with embedded type", function () {
        const applicationDescription = new ApplicationDescription({
            applicationUri: "application:uri",
            productUri: "uri:product",
            applicationName: { text: "MyApplication" },
            applicationType: ApplicationType.Client,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });

        const request = new CreateSessionRequest({
            clientDescription: applicationDescription,
            serverUri: "serverUri",
            endpointUrl: "endpointUrl",
            sessionName: "sessionName",
            clientNonce: Buffer.from("_clientNonce"),
            clientCertificate: undefined,
            requestedSessionTimeout: 300000,
            maxResponseMessageSize: 800000
        });

        request.clientDescription.applicationUri.should.equal("application:uri");
        request.clientDescription.productUri.should.equal("uri:product");
        request.clientDescription.applicationName.text.should.equal("MyApplication");
        request.clientDescription.applicationType.should.equal(ApplicationType.Client);
        request.clientDescription.discoveryUrls.length.should.equal(0);
    });
});
