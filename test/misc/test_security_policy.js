require("requirish")._(module);

var should = require("should");

var securityPolicy_m = require("lib/misc/security_policy");
var SecurityPolicy = securityPolicy_m.SecurityPolicy;
import crypto_utils from "lib/misc/crypto_utils";
    

describe("Security Policy", function () {

    it("should convert a security policy uri to an enum value", function () {

        var enumValue = securityPolicy_m.fromURI("http://opcfoundation.org/UA/SecurityPolicy#None");
        enumValue.should.equal(SecurityPolicy.None);

        enumValue = securityPolicy_m.fromURI("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
        enumValue.should.equal(SecurityPolicy.Basic256Rsa15);
    });

    it("should return SecurityPolicy.Invalid if not supported", function () {

        var enumValue = securityPolicy_m.fromURI("some invalid string");
        enumValue.should.equal(SecurityPolicy.Invalid);

    });
    it("should turn a Security Policy Enum value into an URI", function () {
        var uriValue = securityPolicy_m.toURI(SecurityPolicy.Basic256Rsa15);
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should turn a Security Policy short string to an URI", function () {
        var uriValue = securityPolicy_m.toURI("Basic256Rsa15");
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should thrown an exception when turning an invalid SecurityPolicy into an uri", function () {

        should(function () {
            var uriValue = securityPolicy_m.toURI("<<invalid>>");
            uriValue.should.equal("<invalid>");
        }).throwError();

    });


});

describe("Security Policy computeSignature, verifySignature", function () {


    var path = require("path");
    var crypto = require("crypto");

    var senderCertificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/server_cert_2048.pem"));
    var senderNonce = crypto.randomBytes(32);

    var receiverPrivateKey = crypto_utils.readKey(path.join(__dirname, "../fixtures/certs/client_key_1024.pem"));
    var receiverCertificate = crypto_utils.readKey(path.join(__dirname, "../fixtures/certs/client_cert_1024.pem"));

    var securityPolicy = SecurityPolicy.Basic256;

    senderCertificate.should.be.instanceOf(Buffer);
    senderNonce.should.be.instanceOf(Buffer);
    receiverCertificate.should.be.instanceOf(Buffer);

    beforeEach(function () {


    });

    it("should compute a Signature and verify a signature", function () {

        var signatureData = securityPolicy_m.computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);

        var bIsOk = securityPolicy_m.verifySignature(senderCertificate, senderNonce, signatureData, receiverCertificate, securityPolicy);

        bIsOk.should.be.eql(true);

    });

    it("should not verify a signature that has been tampered", function () {

        var signatureData = securityPolicy_m.computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);


        signatureData.signature.writeUInt8((signatureData.signature.readUInt8(10) + 10) % 256, 10);

        var bIsOk = securityPolicy_m.verifySignature(senderCertificate, senderNonce, signatureData, receiverCertificate, securityPolicy);

        bIsOk.should.be.eql(false);

    });


});


