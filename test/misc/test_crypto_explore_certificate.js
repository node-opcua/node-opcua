// require("requirish")._(module);
// var should = require("should");
// var path = require("path");
// var fs = require("fs");
// var util = require("util");
//
// var crypto_utils = require("lib/misc/crypto_utils");
// var assert = require("better-assert");
// var hexDump = require("lib/misc/utils").hexDump;
//
// var exploreCertificate = require("lib/misc/crypto_explore_certificate").exploreCertificate;
//
//
// describe(" exploring Certificates", function () {
//
//
//     this.timeout(200000);
//     it("should extract the information out of a 1024-bits certificate", function () {
//
//         var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/server_cert_1024.pem"));
//
//         //xx console.log(hexDump(certificate));
//         var certificate_info = exploreCertificate(certificate);
//
//         //xx console.log(certificate_info.tbsCertificate);
//         console.log(" Version                   : ", certificate_info.tbsCertificate.version);
//         console.log(" issuer.commonName         : ", certificate_info.tbsCertificate.issuer.commonName);
//         console.log(" uniformResourceIdentifier : ", certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier);
//         console.log(" dNSName                   : ", certificate_info.tbsCertificate.extensions.subjectAltName.dNSName);
//
//         //xx console.log(require("util").inspect(certificate_info,{colors:true, depth:10}));
//         certificate_info.tbsCertificate.version.should.eql(3);
//         certificate_info.tbsCertificate.subjectPublicKeyInfo.keyLength.should.eql(128);
//         certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.length.should.eql(1);
//
//     });
//
//
//     it("should extract the information out of a 2048-bits certificate ", function () {
//
//         var certificate = crypto_utils.readCertificate(path.join(__dirname, "../fixtures/certs/server_cert_2048.pem"));
//
//         // console.log(hexDump(certificate))
//         var certificate_info = exploreCertificate(certificate);
//
//         certificate_info.tbsCertificate.version.should.eql(3);
//         certificate_info.tbsCertificate.subjectPublicKeyInfo.keyLength.should.eql(256);
//         certificate_info.tbsCertificate.extensions.subjectAltName.uniformResourceIdentifier.length.should.eql(1);
//
//     });
//
//     it("should read a V3 X509 certificate (with extensions)", function () {
//
//         var filename = path.join(__dirname, "../fixtures/certs/demo_certificate.pem");
//         fs.existsSync(filename).should.equal(true);
//
//         var certificate = crypto_utils.readCertificate(filename);
//         //xx console.log(certificate.toString("base64"));
//
//         var certificate_info = exploreCertificate(certificate);
//
//         certificate_info.tbsCertificate.version.should.eql(3);
//
//         // console.log(util.inspect(certificate_info,{colors:true,depth:10}));
//         //xx console.log("x => ",util.inspect(certificate_info.tbsCertificate.extensions.authorityCertIssuer,{colors:true,depth:10}));
//         certificate_info.tbsCertificate.extensions.authorityKeyIdentifier.authorityCertIssuer.directoryName.countryName.should.eql("FR");
//         certificate_info.tbsCertificate.extensions.authorityKeyIdentifier.authorityCertIssuer.directoryName.localityName.should.eql("Paris");
//
//         certificate_info.tbsCertificate.extensions.subjectKeyIdentifier.should.eql('74:38:fd:90:b1:f1:90:51:0e:9c:65:d6:aa:ac:63:9e:bc:dc:58:2f');
//     });
//
//     it("should read a V1 X509 certificate",function() {
//
//         // note : http://stackoverflow.com/questions/26788244/how-to-create-a-legacy-v1-or-v2-x-509-cert-for-testing
//
//         var filename = path.join(__dirname, "../fixtures/certs/demo_certificate_x509_V1.pem");
//         fs.existsSync(filename).should.equal(true,"cerficate file must exist");
//
//         var certificate = crypto_utils.readCertificate(filename);
//         //xx console.log(certificate.toString("base64"));
//         var certificate_info = exploreCertificate(certificate);
//
//         certificate_info.tbsCertificate.version.should.eql(1);
//         should(certificate_info.tbsCertificate.extensions).eql(null);
//
//         // console.log(util.inspect(certificate_info,{colors:true,depth:10}));
//
//     });
// });
//
// var fs = require("fs");
//
// describe("exploring certificate chains", function () {
//
//     var combine_der = require("lib/misc/crypto_explore_certificate").combine_der;
//     var split_der = require("lib/misc/crypto_explore_certificate").split_der;
//
//     it("should combine 2 certificates in a single block", function () {
//
//         var cert1_name = path.join(__dirname, "../fixtures/certs/client_cert_1024.pem");
//         var cert2_name = path.join(__dirname, "../fixtures/certs/server_cert_1024.pem");
//
//         fs.existsSync(cert1_name).should.eql(true);
//         fs.existsSync(cert2_name).should.eql(true);
//
//         var cert1 = crypto_utils.readCertificate(cert1_name);
//         var cert2 = crypto_utils.readCertificate(cert2_name);
//         //xx console.log("cert1 = ",cert1.toString("base64"));
//         //xx console.log("cert2 = ",cert2.toString("base64"));
//
//         var combined = combine_der([cert1, cert2]);
//         combined.toString("hex").should.equal(cert1.toString("hex") + cert2.toString("hex"));
//
//         combined.length.should.eql(cert1.length + cert2.length);
//
//         var chain = split_der(combined);
//
//         chain.length.should.eql(2);
//
//         if(false) {
//             console.log(chain[0].toString("hex"));
//             console.log(cert1.toString("hex"));
//             console.log("-------");
//             console.log(chain[1].toString("hex"));
//             console.log(cert2.toString("hex"));
//         }
//         chain[0].length.should.eql(cert1.length);
//         chain[1].length.should.eql(cert2.length);
//
//         chain[0].toString("hex").should.eql(cert1.toString("hex"));
//         chain[1].toString("hex").should.eql(cert2.toString("hex"));
//     });
//
//     it("should combine 3 certificates in a single block", function () {
//
//         var cert1_name = path.join(__dirname, "../fixtures/certs/client_cert_1024.pem");
//         var cert2_name = path.join(__dirname, "../fixtures/certs/server_cert_1024.pem");
//         var cert3_name = path.join(__dirname, "../fixtures/certs/client_cert_1024.pem");
//
//         fs.existsSync(cert1_name).should.eql(true);
//         fs.existsSync(cert2_name).should.eql(true);
//         fs.existsSync(cert3_name).should.eql(true);
//
//         var cert1 = crypto_utils.readCertificate(cert1_name);
//         var cert2 = crypto_utils.readCertificate(cert2_name);
//         var cert3 = crypto_utils.readCertificate(cert3_name);
//
//         var combined = combine_der([cert1, cert2 , cert3]);
//         combined.toString("hex").should.equal(cert1.toString("hex") + cert2.toString("hex") + cert3.toString("hex"));
//
//         combined.length.should.eql(cert1.length + cert2.length + cert3.length);
//
//         var chain = split_der(combined);
//
//         chain.length.should.eql(3);
//
//         if(false) {
//             console.log(chain[0].toString("hex"));
//             console.log(cert1.toString("hex"));
//             console.log("-------");
//             console.log(chain[1].toString("hex"));
//             console.log(cert2.toString("hex"));
//             console.log("-------");
//             console.log(chain[2].toString("hex"));
//             console.log(cert3.toString("hex"));
//         }
//         chain[0].length.should.eql(cert1.length);
//         chain[1].length.should.eql(cert2.length);
//         chain[2].length.should.eql(cert3.length);
//
//         chain[0].toString("hex").should.eql(cert1.toString("hex"));
//         chain[1].toString("hex").should.eql(cert2.toString("hex"));
//         chain[2].toString("hex").should.eql(cert3.toString("hex"));
//     });
// });
