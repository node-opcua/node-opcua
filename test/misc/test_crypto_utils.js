require("requirish")._(module);
var hexy = require("hexy");
var should = require("should");
var path = require("path");
var crypto_utils = require("lib/misc/crypto_utils");
var make_lorem_ipsum_buffer = require("test/helpers/make_lorem_ipsum_buffer").make_lorem_ipsum_buffer;

describe("Crypto utils", function () {

    it("should read a PEM file", function () {

        var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/demo_certificate.pem"));

        // console.log(certificate.toString("hex"));
        // console.log(certificate.toString("base64"));
        // console.log(hexy.hexy(certificate, {width: 32}));


        certificate.toString("base64").should.equal(
            "MIIEVTCCAz2gAwIBAgICEJEwDQYJKoZIhvcNAQELBQAwgY4xCzAJBgNVBAYTAkZS" +
            "MQwwCgYDVQQIDANJREYxDjAMBgNVBAcMBVBhcmlzMUIwQAYDVQQKDDlGYWtlIE5v" +
            "ZGVPUENVQSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eSAoZm9yIHRlc3Rpbmcgb25s" +
            "eSkxHTAbBgNVBAMMFG5vZGUtb3BjdWEuZ2l0aHViLmlvMB4XDTEzMDIxNDE0Mjgx" +
            "NVoXDTEzMDIyNDE0MjgxNVowMzESMBAGA1UEChMJTm9kZU9QQ1VBMR0wGwYDVQQD" +
            "ExR1cm46Tm9kZU9QQ1VBLVNlcnZlcjCCASIwDQYJKoZIhvcNAQEBBQADggEPADCC" +
            "AQoCggEBAJVeDuZfyHyqJYN9mIfl1TqvaepCSPf4cyU9dRpx+hxciLNzmK7paObL" +
            "/QC8EvY41FIUJOtGMBJeAaZ7loBWNdX2kPA53ImxfJS7GfPqF2wQczdLzC+ToVFR" +
            "fc5X5415pX2Hnjl4ecWs3yOP99QFjiz4FoK0dL80VJed1BgdLIIHcK59g3AWekcF" +
            "nm6xBvkdOlO7w5iGjYzP0F/xxf//32OicQnDCjSTe+D1nZtGZzEGv3GD5MD7p8kc" +
            "p8I5NRI8C+kLCKJRMO3xsZ0ve9hhpskg+PpeF+C3IsdTAyp0mCf3SpIBcuu1zhNI" +
            "+B5ZGpmTmqqeesZE69GZWwnCLiYbzq8CAwEAAaOCARUwggERMAkGA1UdEwQCMAAw" +
            "HQYDVR0OBBYEFHQ4/ZCx8ZBRDpxl1qqsY5683FgvMIGtBgNVHSMEgaUwgaKhgZSk" +
            "gZEwgY4xCzAJBgNVBAYTAkZSMQwwCgYDVQQIDANJREYxDjAMBgNVBAcMBVBhcmlz" +
            "MUIwQAYDVQQKDDlGYWtlIE5vZGVPUENVQSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0" +
            "eSAoZm9yIHRlc3Rpbmcgb25seSkxHTAbBgNVBAMMFG5vZGUtb3BjdWEuZ2l0aHVi" +
            "LmlvggkA3if7nVaKKTUwKgYDVR0RBCMwIYYUdXJuOk5vZGVPUENVQS1TZXJ2ZXKC" +
            "CWxvY2FsaG9zdDAJBgNVHRIEAjAAMA0GCSqGSIb3DQEBCwUAA4IBAQCIJU3XnCT9" +
            "2MBGtWZYeGQtK4kBRIDQiEI0uiT+CDvtIkv/KbqSHBNq04jA9FcwKWwhoI+DCQvj" +
            "yhkdfAb7i4qkd0lq8p/GI9MWpL50k9Rg0Ak/eAjwTSuDNRB1KzMlZtn/+D6fGZbR" +
            "hupROculSJ749son0sP1rBvdJEyKN9v9jQf2nv6jo9wytJKM+VslEMCeBzGhi1n6" +
            "FYHX/e3jaMAQAdkyq9aIQYaHyVQxOBy98B5usZclZ7ry6xf/Rb9bOOP8c61tBQ9k" +
            "SXDGOBbNHWyWf+DqquMvwN0+Ud/n6hhDexyiShstLhKK1gMNpO6ftMZO80HdI/sm" +
            "ynbBVHaSnuA9"
       );

    });


    it("should read a certificate chain",function() {

        var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/demo_certificate_chain.pem"));

        var split_der = require("lib/misc/crypto_explore_certificate").split_der;

        var arrayCertificate =split_der(certificate);

        arrayCertificate.length.should.eql(3);

    });


    it("makeSHA1Thumbprint should produce a 20-byte thumbprint ", function () {


        var buf = make_lorem_ipsum_buffer();

        var digest = crypto_utils.makeSHA1Thumbprint(buf);

        digest.should.be.instanceOf(Buffer);

        digest.length.should.eql(20); // SHA1 should condensed to 160 bits

    });
});


describe("exploreCertificate", function () {

    it("should explore a 1024 bits RSA certificate", function () {

        var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/server_cert_1024.pem"));
        var data = crypto_utils.exploreCertificate(certificate);
        data.publicKeyLength.should.eql(128);
        data.notAfter.should.be.instanceOf(Date);
        data.notBefore.should.be.instanceOf(Date);

    });
    it("should explore a 2048 bits RSA certificate", function () {
        var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/server_cert_2048.pem"));
        var data = crypto_utils.exploreCertificate(certificate);
        data.publicKeyLength.should.eql(256);
        data.notAfter.should.be.instanceOf(Date);
        data.notBefore.should.be.instanceOf(Date);

    });
});
