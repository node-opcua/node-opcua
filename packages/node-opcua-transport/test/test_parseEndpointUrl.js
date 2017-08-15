


var should = require("should");

var parseEndpointUrl = require("../src/tools").parseEndpointUrl;


describe("testing parseEndpointUrl", function () {


    it("should parse a endpoint ", function () {

        var ep = parseEndpointUrl("opc.tcp://abcd1234:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("abcd1234");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function () {

        var ep = parseEndpointUrl("opc.tcp://ABCD12354:51210/UA/SampleServer");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("ABCD12354");
        ep.port.should.equal(51210);
        ep.address.should.equal("/UA/SampleServer");
    });

    it("should parse this endpoint as well", function () {

        var ep = parseEndpointUrl("opc.tcp://portable-Precision-M4500:4841");

        ep.protocol.should.equal("opc.tcp");
        ep.hostname.should.equal("portable-Precision-M4500");
        ep.port.should.equal(4841);
        ep.address.should.equal("");
    });

    it("should raise an exception if Endpoint URL is malformed",function() {

        should(function() {
            var ep = parseEndpointUrl("foo@baz.bar://mymachine:4841");
        }).throwError();
    });


});
