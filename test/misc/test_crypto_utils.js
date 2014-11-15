var hexy = require("hexy");
var should = require("should");

var crypto_utils = require("../../lib/misc/crypto_utils");
var make_lorem_ipsum_buffer = require("../helpers/make_lorem_ipsum_buffer").make_lorem_ipsum_buffer;

describe("Crypto utils", function () {
    it("should read a PEM file",function(){

        var certificate = crypto_utils.readCertificate('certificates/cert.pem');

        if (false) {
            console.log(certificate.toString("hex"));
            console.log(certificate.toString("base64"));
            console.log(hexy.hexy(certificate,{width: 32}));
        }

        certificate.toString("base64").should.equal(
        "MIIDJTCCAo6gAwIBAgIJAKM/ZiaPpHuNMA0GCSqGSIb3DQEBBQUAMHoxCzAJBgNV" +
        "BAYTAkZSMQwwCgYDVQQIEwNJREYxDjAMBgNVBAcTBVBhcmlzMRIwEAYDVQQLEwlB" +
        "Q01FL0xBQk8xGzAZBgNVBAMTEk5vZGVPUENVQS9VQVNlcnZlcjEcMBoGCSqGSIb3"+
        "DQEJARYNaW5mb0BhY21lLmNvbTAeFw0xNDExMDUyMDI3NTlaFw0xNTExMDUyMDI3"+
        "NTlaMHoxCzAJBgNVBAYTAkZSMQwwCgYDVQQIEwNJREYxDjAMBgNVBAcTBVBhcmlz"+
        "MRIwEAYDVQQLEwlBQ01FL0xBQk8xGzAZBgNVBAMTEk5vZGVPUENVQS9VQVNlcnZl"+
        "cjEcMBoGCSqGSIb3DQEJARYNaW5mb0BhY21lLmNvbTCBnzANBgkqhkiG9w0BAQEF"+
        "AAOBjQAwgYkCgYEA1U1fm62pomj2XNuEYZqBXS987Yl0u0BKFt6rwnw6seLQCSkm"+
        "Vray31p5fdkYVFBVwYTYUrk3HDM4qFnsPvJbEAC95TlAAjEb5cW0Xnx9T1nMesIv"+
        "ebBS3u+Dy4CHCOYff2uUY/Dem5wHI//BqbDFtlcJ2uJTfMZBIAytxllubXECAwEA"+
        "AaOBsjCBrzAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIC9DAgBgNVHSUBAf8E"+
        "FjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwTwYDVR0RBEgwRocEfwAAAYYUdXJuOk5v"+
        "ZGVPUENVQS1TZXJ2ZXKCCWxvY2FsaG9zdIIJMTI3LjAuMC4xghJ3d3cueW91cmRv"+
        "bWFpbi50bGQwDAYDVR0OBAUEA/4CETAOBgNVHSMEBzAFgAP+AhEwDQYJKoZIhvcN"+
        "AQEFBQADgYEAtbQnMTrxpAxOo8cYfuIbpjCFPKcEfsxUf55DtX5eWjR98W9eeQxh"+
        "3RhbrU9y9iAqLbTtDLbhpCSKcfKjU8l/maCVKl9VhOW8t8gVaLEwYGAq1BXNrj8f"+
        "Clf72F/neh0haqvQ7BB8hEtiwUQQULxdLbTFEaXGLgA12U2rGadIRv0=");

    });


    it("makeSHA1Thumbprint should produce a 20-byte thumbprint ",function() {


        var buf= make_lorem_ipsum_buffer();

        var digest = crypto_utils.makeSHA1Thumbprint(buf);

        digest.should.be.instanceOf(Buffer);

        digest.length.should.eql(20); // SHA1 should condensed to 160 bits

    });
});


describe("test derived key making",function() {

    var crypto = require("crypto");
    var hexDump = require("./../../lib/misc/utils").hexDump;
    var secret = new Buffer("my secret");
    var seed   = new Buffer("my seed");

    it("should create a large enough p_SHA buffer (makePseudoRandomBuffer)",function() {

        var min_length = 256;
        var buf = crypto_utils.makePseudoRandomBuffer(secret,seed,min_length);
        buf.length.should.be.greaterThan(min_length);
        console.log(hexDump(buf));
    });
    it("should create derived keys (computeDerivedKeys)",function(){

        var options = {
            signingKeyLength: 128,
            encryptingKeyLength: 256,
            encryptingBlockSize: 256,
        };
        var derivedKeys = crypto_utils.computeDerivedKeys(secret,seed,options);

        derivedKeys.signingKey.length.should.eql(options.signingKeyLength);
        derivedKeys.encryptingKey.length.should.eql(options.encryptingKeyLength);
        derivedKeys.initializationVector.length.should.eql(options.encryptingBlockSize);


    });
    it("demonstrating how to use derived key",function(done) {

        var options = {
            signingKeyLength: 32,
            encryptingKeyLength: 128/8,
            encryptingBlockSize: 128/8,
        };
        var derivedKeys = crypto_utils.computeDerivedKeys(secret,seed,options);

        var algorithm = "aes-128-cbc";
        var key = derivedKeys.encryptingKey;
        var initVector = derivedKeys.initializationVector;
        var cypher =     crypto.createCipheriv(algorithm,key,initVector);

        cypher.setAutoPadding(false);

        var clear_message = make_lorem_ipsum_buffer();

        var encrypted_chunks = [];
        encrypted_chunks.push(cypher.update(clear_message));
        // write padding
        var paddingSize = options.encryptingBlockSize - clear_message.length % options.encryptingBlockSize;
        var padding = new Buffer(paddingSize);
        encrypted_chunks.push(cypher.update(padding));
        encrypted_chunks.push(cypher.final());

        var encrypted_message = Buffer.concat(encrypted_chunks);

        console.log(hexDump(encrypted_message));
        console.log(clear_message.length,encrypted_message.length);

        done();

    });
});
