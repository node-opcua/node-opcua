import { ApplicationDescription, ApplicationType } from "node-opcua-service-endpoints";
import should from "should";
import { ActivateSessionRequest, ActivateSessionResponse, CreateSessionRequest, CreateSessionResponse } from "../dist/index.js";

describe("Session Service", () => {
    it("should instantiate a CreateSessionRequest", () => {
        const _obj = new CreateSessionRequest();
    });
    it("should instantiate a CreateSessionResponse", () => {
        const _obj = new CreateSessionResponse();
    });

    it("should instantiate a ActivateSessionRequest", () => {
        const _obj = new ActivateSessionRequest();
    });
    it("should instantiate a ActivateSessionResponse", () => {
        const _obj = new ActivateSessionResponse();
    });

    it("should create a complex type with embedded type", () => {
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

        should(request.clientDescription.applicationUri).equal("application:uri");
        should(request.clientDescription.productUri).equal("uri:product");
        should(request.clientDescription.applicationName.text).equal("MyApplication");
        request.clientDescription.applicationType.should.equal(ApplicationType.Client);
        should(request.clientDescription.discoveryUrls?.length).equal(0);
    });
});
