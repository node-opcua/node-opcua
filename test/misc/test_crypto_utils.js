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

    var options_AES_128_CBC = {
        signingKeyLength: 128,
        encryptingKeyLength: 16,
        encryptingBlockSize: 16,
        signatureLength: 20,
        algorithm:  "aes-128-cbc",
    };
    var options_AES_256_CBC = {
        signingKeyLength: 256,
        encryptingKeyLength: 32,
        encryptingBlockSize: 16,
        signatureLength: 24,
        algorithm:  "aes-256-cbc"
    };
    it("should create a large enough p_SHA buffer (makePseudoRandomBuffer)",function() {

        var min_length = 256;
        var buf = crypto_utils.makePseudoRandomBuffer(secret,seed,min_length);
        buf.length.should.be.equal(min_length);
        //xx console.log(hexDump(buf));
    });

    it('Should compute key using keysize, client and server keys.', function(done) {
        // see https://github.com/leandrob/node-psha1/blob/master/test/lib.index.js#L4
        var secret = new Buffer('GS5olVevYMI4vW1Df/7FUpHcJJopTszp6sodlK4/rP8=',"base64");
        var seed   = new Buffer('LmF9Mjf9lYMa9YkxZDjaRFe6iMAfReKjzhLHDx376jA=',"base64");
        var key = crypto_utils.makePseudoRandomBuffer(secret,seed, 256/8);
        key.toString("base64").should.eql('ZMOP1NFa5VKTQ8I2awGXDjzKP+686eujiangAgf5N+Q=');
        done();
    });

    it("should create derived keys (computeDerivedKeys)",function(){

        var options = options_AES_128_CBC;
        var derivedKeys = crypto_utils.computeDerivedKeys(secret,seed,options);

        derivedKeys.signingKey.length.should.eql(options.signingKeyLength);
        derivedKeys.encryptingKey.length.should.eql(options.encryptingKeyLength);
        derivedKeys.initializationVector.length.should.eql(options.encryptingBlockSize);


    });


    function perform_symmetric_encryption_test(options,done) {

        var derivedKeys = crypto_utils.computeDerivedKeys(secret,seed,options);

        var clear_message = make_lorem_ipsum_buffer();
        //xx Buffer.concat([make_lorem_ipsum_buffer(),make_lorem_ipsum_buffer(),make_lorem_ipsum_buffer()]);
        //xx clear_message = Buffer.concat([clear_message,clear_message,clear_message,clear_message,clear_message]);


        // append padding
        var footer = crypto_utils.computePaddingFooter(clear_message,derivedKeys);
        var clear_message_with_padding = Buffer.concat([clear_message,footer]);

        var  msg= "clear_message length " +clear_message_with_padding.length   + " shall be a multiple of block size="+options.encryptingBlockSize;
        ( clear_message_with_padding.length % options.encryptingBlockSize).should.equal(0,msg);

        var encrypted_message = crypto_utils.encryptBufferWithDerivedKeys(clear_message_with_padding,derivedKeys);

        clear_message_with_padding.length.should.equal(encrypted_message.length );

        var reconstructed_message = crypto_utils.decryptBufferWithDerivedKeys(encrypted_message,derivedKeys);

        reconstructed_message = crypto_utils.removePadding(reconstructed_message);

        reconstructed_message.toString("ascii").should.eql(clear_message.toString("ascii"));

        done();

    }
    it("demonstrating how to use derived keys for symmetric encryption (aes-128-cbc)" ,function(done) {


        perform_symmetric_encryption_test(options_AES_128_CBC,done);

    });
    it("demonstrating how to use derived keys for symmetric encryption (aes-256-cbc)" ,function(done) {

        perform_symmetric_encryption_test(options_AES_256_CBC,done);

    });

    it("should produce a smaller buffer (reduceLength)",function() {

        var buffer = new Buffer("Hello World","ascii");
        var reduced = crypto_utils.reduceLength(buffer,6);
        reduced.toString("ascii").should.equal("Hello");

    });

    it("demonstrating how to use derived keys for signature",function() {

        var options = options_AES_128_CBC;

        var derivedKeys = crypto_utils.computeDerivedKeys(secret,seed,options);

        var clear_message = make_lorem_ipsum_buffer();

        var signature = crypto_utils.makeMessageChunkSignatureWithDerivedKeys(clear_message,derivedKeys);

        signature.length.should.eql(20);

        var signed_message = Buffer.concat([clear_message,signature]);

        crypto_utils.verifyChunkSignatureWithDerivedKeys(signed_message,derivedKeys).should.equal(true);

        // let's corrupt the message ...
        signed_message.write("HELLO",0x50);

        // ... and verify that signature verification returns a failure
        crypto_utils.verifyChunkSignatureWithDerivedKeys(signed_message,derivedKeys).should.equal(false);

    });
});

describe("exploreCertificate",function(){

    it("should explore a 1024 bits RSA certificate",function(){

        var certificate = crypto_utils.readCertificate('certificates/cert.pem');
        var data  = crypto_utils.exploreCertificate(certificate);
        data.publicKeyLength.should.eql(128);
        data.notAfter.should.be.instanceOf(Date);
        data.notBefore.should.be.instanceOf(Date);

    });
    it("should explore a 2048 bits RSA certificate",function() {
        var certificate = crypto_utils.readCertificate('certificates/server_cert256.pem');
        var data  = crypto_utils.exploreCertificate(certificate);
        data.publicKeyLength.should.eql(256);
        data.notAfter.should.be.instanceOf(Date);
        data.notBefore.should.be.instanceOf(Date);

    });
});
