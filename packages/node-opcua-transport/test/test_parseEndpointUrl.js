const should = require("should");

const parseEndpointUrl = require("..").parseEndpointUrl;

describe("testing parseEndpointUrl", function () {
    it("should parse a endpoint ", function () {
        const ep = parseEndpointUrl("opc.tcp://abcd1234:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp:");
        ep.hostname.should.equal("abcd1234");
        ep.port.should.eql("51210");
        ep.pathname.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function () {
        const ep = parseEndpointUrl("opc.tcp://ABCD12354:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp:");
        ep.hostname.should.equal("abcd12354");
        ep.port.should.eql("51210");
        ep.pathname.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function () {
        const ep = parseEndpointUrl("opc.tcp://portable-Precision-M4500:4841");

        ep.protocol.should.equal("opc.tcp:");
        ep.hostname.should.equal("portable-precision-m4500");
        ep.port.should.eql("4841");
        should.not.exist(ep.pathname);
    });

    it("should raise an exception if Endpoint URL is malformed", function () {
        should(function () {
            const ep = parseEndpointUrl("foo@baz.bar://mymachine:4841");
        }).throwError();
    });

    it("should parse a url containing a username and password", function () {
        const ep = parseEndpointUrl("opc.tcp://user:password@machine.com:4841");

        ep.protocol.should.equal("opc.tcp:");
        ep.hostname.should.equal("machine.com");
        ep.port.should.eql("4841");
        ep.auth.should.eql("user:password");
        should.not.exist(ep.pathname);
    });
});
