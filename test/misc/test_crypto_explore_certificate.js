require("requirish")._(module);
var should = require("should");
var path = require("path");
var fs = require("fs");
var crypto_utils = require("lib/misc/crypto_utils");
var assert = require("assert");
var hexDump = require("../../lib/misc/utils").hexDump;

var exploreCertificate = require("../../lib/misc/crypto_explore_certificate").exploreCertificate;


describe(" exploring Certificates",function() {


    this.timeout(100000);
    it("should extract the information out of a 1024-bits certificate",function() {

        var certificate = crypto_utils.readCertificate(path.join(__dirname,"../fixtures/certs/server_cert_1024.pem"));

        //xx console.log(hexDump(certificate));
        var certificate_info = exploreCertificate(certificate);

        //xx console.log(certificate_info.tbsCertificate);
        console.log(" Version                   : ",certificate_info.tbsCertificate.version);
        console.log(" issuer.commonName         : ",certificate_info.tbsCertificate.issuer.commonName);
        console.log(" uniformResourceIdentifier : ",certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier);
        console.log(" dNSName                   : ",certificate_info.tbsCertificate.extensions.subjectAltName.dNSName);

        //xx console.log(require("util").inspect(certificate_info,{colors:true, depth:10}));
        certificate_info.tbsCertificate.version.should.eql(2);
        certificate_info.tbsCertificate.subjectPublicKeyInfo.keyLength.should.eql(128);
        certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.length.should.eql(1);

    });


    it("should extract the information out of a 2048-bits certificate ",function() {

        var certificate = crypto_utils.readCertificate(path.join(__dirname,"../fixtures/certs/server_cert_2048.pem"));

        // console.log(hexDump(certificate))
        var certificate_info = exploreCertificate(certificate);

        certificate_info.tbsCertificate.version.should.eql(2);
        certificate_info.tbsCertificate.subjectPublicKeyInfo.keyLength.should.eql(256);
        certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.length.should.eql(1);

    });

    it("should read a certificate containing extra information",function() {

        var filename = path.join(__dirname,"../fixtures/certs/demo_certificate.pem");
        fs.existsSync(filename).should.equal(true);

        var certificate = crypto_utils.readCertificate(filename);
        console.log(certificate.toString("base64"));

        var certificate_info = exploreCertificate(certificate);
        console.log(certificate_info);
        console.log(" Version                   : ",certificate_info.tbsCertificate.version);

    });
});