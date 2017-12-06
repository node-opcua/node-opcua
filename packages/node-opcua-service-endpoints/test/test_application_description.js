var ApplicationDescription = require("..").ApplicationDescription;
var ApplicationType = require("..").ApplicationType;

describe("OPCUA Object creation", function () {

    it("should create a complex type with embedded type", function () {

        var applicationDescription = new ApplicationDescription({
            applicationUri: "application:uri",
            productUri: "uri:product",
            applicationName: {text: "MyApplication"},
            applicationType: ApplicationType.CLIENT,
            gatewayServerUri: undefined,
            discoveryProfileUri: undefined,
            discoveryUrls: []
        });
        applicationDescription.applicationUri.should.equal("application:uri");
        applicationDescription.productUri.should.equal("uri:product");
        applicationDescription.applicationName.text.should.equal("MyApplication");
        applicationDescription.applicationType.should.equal(ApplicationType.CLIENT);
        applicationDescription.discoveryUrls.length.should.equal(0);

    });

});
