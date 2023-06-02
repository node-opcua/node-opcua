"use strict";

const crypto = require("crypto");
const should = require("should");
const { readCertificate, readPrivateKeyPEM } = require("node-opcua-crypto");
const { getFixture } = require("node-opcua-test-fixtures");


const { SecurityPolicy, fromURI, toURI, computeSignature, verifySignature } = require("..");

describe("Security Policy", function () {
    it("should convert a security policy uri to an enum value", function () {
        let enumValue = fromURI("http://opcfoundation.org/UA/SecurityPolicy#None");
        enumValue.should.equal(SecurityPolicy.None);

        enumValue = fromURI("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
        enumValue.should.equal(SecurityPolicy.Basic256Rsa15);
    });

    it("should return SecurityPolicy.Invalid if not supported", function () {
        const enumValue = fromURI("some invalid string");
        enumValue.should.equal(SecurityPolicy.Invalid);
    });
    it("should turn a Security Policy Enum value into an URI", function () {
        const uriValue = toURI(SecurityPolicy.Basic256Rsa15);
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should turn a Security Policy short string to an URI", function () {
        const uriValue = toURI("Basic256Rsa15");
        uriValue.should.equal("http://opcfoundation.org/UA/SecurityPolicy#Basic256Rsa15");
    });
    it("should thrown an exception when turning an invalid SecurityPolicy into an uri", function () {
        should(function () {
            const uriValue = toURI("<<invalid>>");
            uriValue.should.equal("<invalid>");
        }).throwError();
    });
});

describe("Security Policy computeSignature, verifySignature", function () {
    const senderCertificate = readCertificate(getFixture("certs/server_cert_2048.pem"));
    const senderNonce = crypto.randomBytes(32);

    const receiverPrivateKey = readPrivateKeyPEM(getFixture("certs/client_key_1024.pem"));
    const receiverCertificate = readCertificate(getFixture("certs/client_cert_1024.pem"));

    const securityPolicy = SecurityPolicy.Basic256;

    senderCertificate.should.be.instanceOf(Buffer);
    senderNonce.should.be.instanceOf(Buffer);
    receiverCertificate.should.be.instanceOf(Buffer);

    beforeEach(function () {
        /**  */
    });

    it("should compute a Signature and verify a signature", function () {
        const signatureData = computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);

        const bIsOk = verifySignature(senderCertificate, senderNonce, signatureData, receiverCertificate, securityPolicy);

        bIsOk.should.be.eql(true);
    });

    it("should not verify a signature that has been tampered", function () {
        const signatureData = computeSignature(senderCertificate, senderNonce, receiverPrivateKey, securityPolicy);

        signatureData.signature.writeUInt8((signatureData.signature.readUInt8(10) + 10) % 256, 10);

        const bIsOk = verifySignature(senderCertificate, senderNonce, signatureData, receiverCertificate, securityPolicy);

        bIsOk.should.be.eql(false);
    });
});
