const should = require("should");

const parseEndpointUrl = require("../src/tools").parseEndpointUrl;

describe("testing parseEndpointUrl", function() {
    it("should parse a endpoint ", function() {
        const ep = parseEndpointUrl("opc.tcp://abcd1234:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("abcd1234");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function() {
        const ep = parseEndpointUrl("opc.tcp://ABCD12354:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("ABCD12354");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function() {
        const ep = parseEndpointUrl("opc.tcp://portable-Precision-M4500:4841");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("portable-Precision-M4500");
        ep.port.should.equal(4841);
        ep.address.should.equal("");
    });

    it("should raise an exception if Endpoint URL is malformed", function() {
        should(function() {
            const ep = parseEndpointUrl("foo@baz.bar://mymachine:4841");
        }).throwError();
    });

    it("should raise an exception if Endpoint URL is missing a port", function() {
        should(function() {
            const ep = parseEndpointUrl("opc.tcp://192.168.178.142/UA/myLittleServer");
        }).throwError();
    });

    it("should raise an exception if Endpoint URL is missing a port number", function() {
        should(function() {
            const ep = parseEndpointUrl("https://192.168.178.142:");
        }).throwError();
    });

    it("should raise an exception if Endpoint URL Port is malformed", function() {
        should(function() {
            const ep = parseEndpointUrl("https://192.168.178.142:87ad4");
        }).throwError();
    });

    it("should raise an exception if Endpoint URL port is out of bounds", function() {
        should(function() {
            const ep = parseEndpointUrl("https://192.168.178.142:123456");
        }).throwError();
    });
});
