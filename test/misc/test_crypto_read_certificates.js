require("requirish")._(module);
var should = require("should");

var crypto_utils = require("lib/misc/crypto_utils");
var assert = require("assert");
var hexDump = require("../../lib/misc/utils").hexDump;

var readCertificate = require("../../lib/misc/crypto_read_certificate").readCertificate;


describe(" exploring Certificates",function() {

    var certificate = crypto_utils.readCertificate(__dirname+ "/../../certificates/cert.pem");

    this.timeout(100000);
    it("should extract the information out of a 1024-bits certificate",function() {

        //xx console.log(hexDump(certificate));
        var certificate_info = readCertificate(certificate);

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

        var certificate = crypto_utils.readCertificate(__dirname+ "/../../certificates/server_cert256.pem");
        // console.log(hexDump(certificate))
        var certificate_info = readCertificate(certificate);

        certificate_info.tbsCertificate.version.should.eql(2);
        certificate_info.tbsCertificate.subjectPublicKeyInfo.keyLength.should.eql(256);
        certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.length.should.eql(1);

    });
});