var hexy = require("hexy");
var should = require("should");
var  readCertificate = require("../../lib/misc/crypto_utils").readCertificate;
var makeSHA1Thumbprint = require("../../lib/misc/crypto_utils").makeSHA1Thumbprint;
describe("Crypto utils", function () {
    it("should read a PEM file",function(){

        var certificate = readCertificate('certificates/cert.pem');

        if (false) {
            console.log(certificate.toString("hex"));
            console.log(certificate.toString("base64"));
            console.log(hexy.hexy(certificate,{width: 32}));
        }

        certificate.toString("base64").should.equal(
            "MIICWDCCAcGgAwIBAgIJAKAF+z23HN6iMA0GCSqGSIb3DQEBBQUAMEUxCzAJBgNV"+
            "BAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX"+
            "aWRnaXRzIFB0eSBMdGQwHhcNMTQwMTIzMTcwNjQwWhcNMTQwMjIyMTcwNjQwWjBF"+
            "MQswCQYDVQQGEwJGUjETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50"+
            "ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKB"+
            "gQDZNg/P2jFcgm0UXfVfPuf5IysyvMjEYzPc2cEDHUs71jFOCRvwCC6XWcfqy65y"+
            "wtCMLVY0buF1JfYkPpHYvV/JdzUtOctjYXsJpZKTluzVzMYnIMzO9a06cBfcIdSJ"+
            "FlD1l1/S9yqhePKMeP3zvE0s1rV+KdqddamGIYZTO/0c3QIDAQABo1AwTjAdBgNV"+
            "HQ4EFgQUa1kfTd4puyPYTNJ3fuJn60rTjbcwHwYDVR0jBBgwFoAUa1kfTd4puyPY"+
            "TNJ3fuJn60rTjbcwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQUFAAOBgQB2X6Cf"+
            "7oQ8rGTzSnLlS16KUTG+FYsf0ipOz2awBsCFzjXoAicskZBSTOPRxb6uh/3sml09"+
            "K1b7gag6mdaI1/rNrFRfzUuerWS3LdcdkbFxj6GicXOVJwPsiGn8OwabAC+uAJJF"+
            "0C5Y1sOVCDQUW6/B2PaED5e8wnaPp56apHJ9Uw=="
        );

    });

    it("should sign a message",function() {

    });

    it("makeSHA1Thumbprint should produce a 20-byte thumbprint ",function() {


        var make_lorem_ipsum_buffer = require("../helpers/make_lorem_ipsum_buffer").make_lorem_ipsum_buffer;

        var buf= make_lorem_ipsum_buffer();

        var digest = makeSHA1Thumbprint(buf);

        digest.should.be.instanceOf(Buffer);

        digest.length.should.eql(20); // SHA1 should condensed to 160 bits

    });
});
