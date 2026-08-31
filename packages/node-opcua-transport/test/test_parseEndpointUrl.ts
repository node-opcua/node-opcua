import should from "should";

import { parseEndpointUrl } from "../dist/source/index.js";

describe("testing parseEndpointUrl", () => {
    it("should parse a endpoint ", () => {
        const ep = parseEndpointUrl("opc.tcp://abcd1234:51210/UA/SampleServer");

        should(ep.protocol).equal("opc.tcp:");
        should(ep.hostname).equal("abcd1234");
        should(ep.port).eql("51210");
        should(ep.pathname).equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", () => {
        const ep = parseEndpointUrl("opc.tcp://ABCD12354:51210/UA/SampleServer");

        should(ep.protocol).equal("opc.tcp:");
        should(ep.hostname).equal("abcd12354"); /// note that the hostname is now lowercased
        should(ep.port).eql("51210");
        should(ep.pathname).equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", () => {
        const ep = parseEndpointUrl("opc.tcp://portable-Precision-M4500:4841");

        should(ep.protocol).equal("opc.tcp:");
        should(ep.hostname).equal("portable-precision-m4500");
        should(ep.port).eql("4841");
        should.not.exist(ep.pathname);
    });

    it("should raise an exception if Endpoint URL is malformed", () => {
        should(() => {
            const _ep = parseEndpointUrl("foo@baz.bar://my-machine:4841");
        }).throwError();
    });

    it("should parse a url containing a username and password", () => {
        const ep = parseEndpointUrl("opc.tcp://user:password@machine.com:4841");

        should(ep.protocol).equal("opc.tcp:");
        should(ep.hostname).equal("machine.com");
        should(ep.port).eql("4841");
        should(ep.auth).eql("user:password");
        should.not.exist(ep.pathname);
    });
});
