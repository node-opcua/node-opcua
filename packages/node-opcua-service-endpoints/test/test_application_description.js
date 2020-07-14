const ApplicationDescription = require("..").ApplicationDescription;
const ApplicationType = require("..").ApplicationType;

describe("OPCUA Object creation", function() {

    it("should create a complex type with embedded type", function() {

        const applicationDescription = new ApplicationDescription({
            applicationUri: "urn:application",
            productUri: "urn:product",
            applicationName: { text: "MyApplication" },
            applicationType: ApplicationType.Client,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });
        applicationDescription.applicationUri.should.equal("urn:application");
        applicationDescription.productUri.should.equal("urn:product");
        applicationDescription.applicationName.text.should.equal("MyApplication");
        applicationDescription.applicationType.should.equal(ApplicationType.Client);
        applicationDescription.discoveryUrls.length.should.equal(0);

    });

});
