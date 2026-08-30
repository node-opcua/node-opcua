import should from "should";
import { ApplicationDescription, ApplicationType } from "..";

describe("OPCUA Object creation", () => {
    it("should create a complex type with embedded type", () => {
        const applicationDescription = new ApplicationDescription({
            applicationUri: "urn:application",
            productUri: "urn:product",
            applicationName: { text: "MyApplication" },
            applicationType: ApplicationType.Client,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });
        should(applicationDescription.applicationUri).equal("urn:application");
        should(applicationDescription.productUri).equal("urn:product");
        should(applicationDescription.applicationName.text).equal("MyApplication");
        applicationDescription.applicationType.should.equal(ApplicationType.Client);
        should(applicationDescription.discoveryUrls?.length).equal(0);
    });
});
