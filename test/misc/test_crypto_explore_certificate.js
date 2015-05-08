require("requirish")._(module);
var should = require("should");
var path = require("path");
var fs = require("fs");
var crypto_utils = require("lib/misc/crypto_utils");
var assert = require("better-assert");
var hexDump = require("lib/misc/utils").hexDump;

var exploreCertificate = require("lib/misc/crypto_explore_certificate").exploreCertificate;


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
        //xx console.log(certificate.toString("base64"));

        var certificate_info = exploreCertificate(certificate);
        //xx console.log(certificate_info);
        //xx console.log(" Version                   : ",certificate_info.tbsCertificate.version);

    });
});

describe("exploring certificate chains",function() {

    var combine_der = require("lib/misc/crypto_explore_certificate").combine_der;
    var split_der = require("lib/misc/crypto_explore_certificate").split_der;

    xit("should combine certificates in a single block",function(){

        var cert1_name = path.join(__dirname,"../fixtures/certs/client_cert_2048.pem");
        var cert2_name = path.join(__dirname,"../fixtures/certs/server_cert_1024.pem");

        var cert1 = crypto_utils.readPEM(cert1_name);
        var cert2 = crypto_utils.readPEM(cert2_name);

        var combined = combine_der([cert1,cert2]);
        combined.toString("hex").should.equal(cert1.toString("hex")+cert2.toString("hex"));

        combined.length.should.eql(cert1.length+ cert2.length);

        var chain  = split_der(combined);

        chain.length.should.eql(2);

        console.log(chain[0].toString("hex"));
        console.log(cert1.toString("hex"));
        console.log("-------")
        console.log(chain[1].toString("hex"));
        console.log(cert2.toString("hex"));

        chain[0].length.should.eql(cert1.length);
        chain[1].length.should.eql(cert2.length);

    })
});
