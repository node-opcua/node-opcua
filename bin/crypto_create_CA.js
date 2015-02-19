// ---------------------------------------------------------------------------------------------------------------------
// node-opcua
// ---------------------------------------------------------------------------------------------------------------------
// Copyright (c) 2014-2015 - Etienne Rossignon - etienne.rossignon (at) gadz.org
// ---------------------------------------------------------------------------------------------------------------------
//
// This  project is licensed under the terms of the MIT license.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so,  subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ---------------------------------------------------------------------------------------------------------------------

var child_process = require("child_process");
var async = require("async");
var _ =require("underscore");
var assert =require("assert");
var byline = require('byline');
var argv = require('optimist')
    .usage('Usage: $0 [--dev] [--silent]')
    .argv;

var isDevelopment = argv.dev;

var assert = require("assert");
var colors = require("colors");
var path = require("path");
var fs = require("fs");

var get_fully_qualified_domain_name = require("../lib/misc/hostname").get_fully_qualified_domain_name;

function make_path(folder_name,file_name) {
    var s =  path.normalize(path.join(folder_name,file_name));
    s = s.replace(/\\/g,"/");
    return s;
}

var certificateDir = make_path(__dirname,"../certificates/");

var pkiDir = make_path(certificateDir,"PKI");
var rootDir = make_path(pkiDir,"CA");

function configurationFile() {
/*
#.........DO NOT MODIFY BY HAND .........................
[ ca ]
default_ca = CA_default

[ CA_default ]

dir= %%ROOT_FOLDER%%                         # the main CA folder
certs = $dir/certs                           # where to store certificates
new_certs_dir = $dir/certs                   #
database = $dir/index.txt                    # the certificate database
serial = $dir/serial                         # the serial number counter
certificate = $dir/private/cacert.pem        # The root CA certificate
private_key = $dir/private/cakey.pem         # the CA private key

x509_extensions = usr_cert                   #
default_days = 3650                          # default duration : 10 years

default_md = sha1
# default_md = sha256                          # The default digest algorithm

preserve = no
policy = policy_match


#RANDFILE = $dir/private/.rand

#default_startdate = YYMMDDHHMMSSZ
#default_enddate = YYMMDDHHMMSSZ

crl_dir = $dir/crl
#crl_extensions = crl_ext
crl = $dir/revocation_list.crl              # the Revocation list

default_crl_days= 30
default_crl_hours = 24
#msie_hack

[ policy_match ]
countryName = optional
stateOrProvinceName = optional
localityName = optional
organizationName = optional
organizationalUnitName = optional
commonName = optional
emailAddress = optional

[ req ]
default_bits = 4096                             # Size of keys
default_keyfile = key.pem                       # name of generated keys
distinguished_name = req_distinguished_name
attributes = req_attributes
x509_extensions = v3_ca
#input_password
#output_password
string_mask = nombstr # permitted characters
req_extensions = v3_req

[ req_distinguished_name ]
# countryName = Country Name (2 letter code)
# countryName_default = FR
# countryName_min = 2
# countryName_max = 2
# stateOrProvinceName = State or Province Name (full name)
# stateOrProvinceName_default = Ile de France
# localityName = Locality Name (city, district)
# localityName_default = Paris
organizationName = Organization Name (company)
organizationName_default = NodeOPCUA
# organizationalUnitName = Organizational Unit Name (department, division)
# organizationalUnitName_default = R&D
commonName = Common Name (hostname, FQDN, IP, or your name)
commonName_max = 64
commonName_default = $ENV::ALTNAME_URI
# emailAddress = Email Address
# emailAddress_max = 40
# emailAddress_default = node-opcua (at) node-opcua (dot) com

[ req_attributes ]
#challengePassword = A challenge password
#challengePassword_min = 4
#challengePassword_max = 20
#unstructuredName = An optional company name

[ usr_cert ]
basicConstraints=critical, CA:FALSE
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer:always
#authorityKeyIdentifier=keyid
subjectAltName=@alt_names
# issuerAltName=issuer:copy
nsComment = ''OpenSSL Generated Certificate''
#nsCertType = client, email, objsign for ''everything including object signing''
#nsCaRevocationUrl = http://www.domain.dom/ca-crl.pem
#nsBaseUrl =
#nsRenewalUrl =
#nsCaPolicyUrl =
#nsSslServerName =
keyUsage = critical, digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment, keyAgreement, keyCertSign
extendedKeyUsage=critical,serverAuth ,clientAuth

[ v3_req ]
basicConstraints =critical, CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyAgreement
# subjectAltName=$ENV::ALTNAME
subjectAltName= @alt_names

[ alt_names ]
URI = $ENV::ALTNAME_URI
DNS.0 = $ENV::ALTNAME_DNS
DNS.1 = $ENV::ALTNAME_DNS_1

[ v3_ca ]
subjectKeyIdentifier=hash
# authorityKeyIdentifier = keyid:always,issuer:always
authorityKeyIdentifier = keyid
basicConstraints = CA:TRUE
keyUsage = critical, cRLSign, keyCertSign
nsComment = "CA root certificate"
#nsCertType = sslCA, emailCA
#subjectAltName=email:copy
#issuerAltName=issuer:copy
#obj=DER:02:03

[ v3_selfsigned]
basicConstraints =critical, CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyAgreement
nsComment = "Self-signed certificate"
subjectAltName= @alt_names

[ crl_ext ]
#issuerAltName=issuer:copy
authorityKeyIdentifier=keyid:always,issuer:always
*/
}
function inlineText(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}

function mkdir(folder) {
    if (!fs.existsSync(folder)) {
        console.log(" .. constructing ".white,folder);
        fs.mkdirSync(folder);
    }
}

function Title(str,option_callback){

    if(!argv.silent) {
        console.log("");
        console.log(str.yellow.bold);
        console.log(new Array(str.length+1).join("=").yellow,"\n");
    }
    if (option_callback) {option_callback();}
}

function Subtitle(str,option_callback){

    if(!argv.silent) {
        console.log("");
        console.log("    " + str.yellow.bold);
        console.log("    " + new Array(str.length + 1).join("-").white, "\n");
    }
    if (option_callback) {option_callback();}
}


function execute(cmd,callback) {

    assert(_.isFunction(callback));

    if(!argv.silent) {
        console.log("    " + cmd.cyan.bold );
    }
    var child = child_process.exec(cmd, { cwd: rootDir },function(err){
        callback(err);
    });

    if(!argv.silent) {
        var stream1 = byline(child.stderr);
        stream1.on('data', function (line) {
            process.stdout.write("        err " + line.red + "\n");
        });
        var stream2 = byline(child.stdout);
        stream2.on('data', function (line) {
            process.stdout.write("        out " + line.white.bold + "\n");
        });
    }
}


function construct_CertificateAuthority(done) {

    // create the CA directory store
    //
    // PKI/CA
    //  |
    //  +-+> private
    //  +-+> certs
    //  +-+> conf
    //
    mkdir(certificateDir);
    mkdir(pkiDir);
    mkdir(rootDir);
    mkdir(path.join(rootDir,"private"));
    //Xx execute("chmod 700 private");

    mkdir(path.join(rootDir,"certs"));
    mkdir(path.join(rootDir,"crl"));
    mkdir(path.join(rootDir,"conf"));

    var serial =path.join(rootDir,"serial");
    if (!fs.existsSync(serial)) {
        fs.writeFileSync(serial,"1000");
    }

    var crlnumber =path.join(rootDir,"crlnumber");
    if (!fs.existsSync(serial)) {
        fs.writeFileSync(serial,"1000   ");
    }

    var index_file =path.join(rootDir,"index.txt");
    if (!fs.existsSync(index_file)) {
        fs.writeFileSync(index_file,"");
    }
    Title("Create Certificate Authority (CA)");

    var index_file_attr =path.join(rootDir,"index.txt.attr");
    if (!fs.existsSync(index_file_attr)) {
        fs.writeFileSync(index_file_attr,"unique_subject = no");
    }

    var ca_conf =path.join(rootDir,"conf/caconfig.cnf");
    if (1 || !fs.existsSync(ca_conf)) {
        var data = inlineText(configurationFile)
        data = data.replace(/%%ROOT_FOLDER%%/,rootDir);
        fs.writeFileSync(ca_conf,data);
    }

    console.log(" ROOT =",rootDir);

    // http://www.akadia.com/services/ssh_test_certificate.html

    var subject  ="/C=FR/ST=IDF/L=Paris/O=Fake CA for Test/CN=NodeOPCUA";

    process.env.ALTNAME_URI = "";
    process.env.ALTNAME_DNS = "";
    process.env.ALTNAME_DNS_1 = "";

    var tasks = [

        Title.bind(null,"Generate the CA private Key"),
        // The first step is to create your RSA Private Key. This key is a 2048 bit RSA key which is encrypted using
        // Triple-DES and stored in a PEM format so that it is readable as ASCII text.
        execute.bind(null,"openssl genrsa -out private/cakey.pem 2048"),

        Title.bind(null,"Generate a certificate request for the CA key"),
        // Once the private key is generated a Certificate Signing Request can be generated.
        // The CSR is then used in one of two ways. Ideally, the CSR will be sent to a Certificate Authority, such as
        // Thawte or Verisign who will verify the identity of the requestor and issue a signed certificate.
        // The second option is to self-sign the CSR, which will be demonstrated in the next section
        execute.bind(null, "openssl req -new" +
                            " -extensions v3_ca" +
                            " -config " +  "conf/caconfig.cnf" +
                            " -key private/cakey.pem "+
                            " -out private/cakey.csr " +
                            " -subj '" +subject + "'"),

        //Xx // Step 3: Remove Passphrase from Key
        //Xx execute("cp private/cakey.pem private/cakey.pem.org");
        //Xx execute("openssl rsa -in private/cakey.pem.org -out private/cakey.pem -passin pass:"+paraphrase);

        Title.bind(null,"Generate CA Certificate (self-signed)"),
        execute.bind(null,"openssl x509 -req -days 3650 " +
        " -extensions v3_ca" +
        " -extfile " +  "conf/caconfig.cnf" +
                          " -in private/cakey.csr " +
                          " -signkey private/cakey.pem " +
                          " -out private/cacert.pem")
    ];

    async.series(tasks,done);

}

function x509Date(date) {

    var Y = date.getUTCFullYear()-2000;
    var M = date.getUTCMonth() +1;
    var D = date.getUTCDate();
    var h = date.getUTCHours();
    var m = date.getUTCMinutes();
    var s = date.getUTCSeconds();

    function w(s,l) {
        return ("00000"+s).substr(-l,l);
    }
    return w(Y,2)+ w(M,2) + w(D,2) + w(h,2) + w(m,2) + w(s,2) + "Z";

}

var caCertificate_With_CRL = "cacertificate_with_crl.pem";

function constructCACertificateWithCRL(callback) {

    assert(_.isFunction(callback));

    var cacert_with_crl = path.join(rootDir,caCertificate_With_CRL);

    // note : in order to check if the certificat is revoked,
    // you need to specify -crl_check and have both the CA cert and the (applicable) CRL in your truststore.
    // There are two ways to do that:
    // 1. concatenate cacert.pem and crl.pem into one file and use that for -CAfile.
    // 2. use some linked
    // ( from http://security.stackexchange.com/a/58305/59982)

    var cacert_filename  = path.join(rootDir,"./private/cacert.pem");
    var crl_filename  = path.join(rootDir,"./crl/revocation_list.crl");
    if (fs.existsSync(crl_filename)) {
        fs.writeFileSync(cacert_with_crl,fs.readFileSync(cacert_filename) + fs.readFileSync(crl_filename));
    } else {
        // there is no revocation list yet
        fs.writeFileSync(cacert_with_crl,fs.readFileSync(cacert_filename));
    }
    callback();
}

/**
 * create a RSA PRIVATE KEY
 *
 * @method createPrivateKey
 *
 * @param private_key_filename
 * @param key_length
 */
function createPrivateKey(private_key_filename,key_length,callback) {

    assert([1024, 2048, 4096].indexOf(key_length) >= 0);
    execute("openssl genrsa -out " + private_key_filename + " " + key_length,callback);
}


/**
 * extract public key from private key
 *   openssl rsa -pubout -in private_key.pem
 *
 * @method getPublicKeyFromPrivateKey
 * @param private_key_filename
 * @param public_key_filename
 * @param callback
 */
function getPublicKeyFromPrivateKey(private_key_filename,public_key_filename,callback) {
    execute("openssl rsa -pubout -in " + private_key_filename + " > "+ public_key_filename,callback);
}

/**
 * extract public key from a certificate
 *   openssl x509 -pubkey -in certificate.pem -nottext
 *
 * @method getPublicKeyFromCertificate
 * @param private_key_filename
 * @param public_key_filename
 * @param callback
 */
function getPublicKeyFromCertificate(certificate_filename,public_key_filename,callback) {
    execute("openssl x509 -pubkey -in" +  certificate_filename + " -notext  > " +public_key_filename,callback);
}


function renew_certificate( certificate,new_startDate,new_endDate,callback) {

    async.series([
        Subtitle.bind(null,"renew_certificate"),

        execute.bind(null,"openssl ca -config " +  "conf/caconfig.cnf" +
                            " -policy policy_anything " +
                            " -out newcert.pem "+
                            " -infiles newreq.pem "+
                            " -startdate  " + new_startDate +
                            " -enddate " + new_endDate)
    ],callback);

}

/**
 * create a certificate issued by the Certification Authority
 * @method createCertificate
 * @param certname
 * @param private_key
 * @param applicationUri
 * @param startDate
 * @param duration
 * @param callback
 */
function _createCertificate(self_signed,certname,private_key,applicationUri,startDate,duration,callback) {

    assert(_.isFunction(callback));
    duration = duration || 365; // one year

    assert(typeof certname === "string");
    assert(typeof private_key === "string");
    assert(typeof applicationUri === "string");
    assert(startDate instanceof Date);

    startDate = startDate || new Date();

    var endDate = new Date(startDate.getTime());
    endDate.setDate(startDate.getDate()+duration);

    startDate = x509Date(startDate);
    endDate = x509Date(endDate);


    var csr_file = certname + "_csr";
    var certificate_file = certname;

    // ApplicationURI
    process.env.ALTNAME_URI = applicationUri;
    // the list of HostName
    process.env.ALTNAME_DNS   = "localhost";
    process.env.ALTNAME_DNS_1 = get_fully_qualified_domain_name();



    var sign_certificate =  function(){};
    if (self_signed) {
        sign_certificate= [
            Subtitle.bind(null,"- creating the self signed certificate"),
            execute.bind(null,"openssl ca -config " + "conf/caconfig.cnf" +
            " -selfsign "+
            " -keyfile "+ private_key +
            " -startdate " + startDate +
            " -enddate " + endDate +
            " -batch -out "  + certificate_file +  " -in "+ csr_file)
        ];

    } else {
        sign_certificate= [
            Subtitle.bind(null,"- then we ask the authority to sign the certificate signing request"),
            execute.bind(null,"openssl ca -config " + "conf/caconfig.cnf" +
            " -startdate " + startDate +
            " -enddate " + endDate +
            " -batch -out "  + certificate_file +  " -in "+ csr_file)
        ]
    }
    var tasks =[

        Subtitle.bind(null,"- the certificate signing request"),
        execute.bind(null,"openssl req -config " + "conf/caconfig.cnf" + " -batch -new -key " +private_key + " -out " + csr_file),

        sign_certificate[0],
        sign_certificate[1],

        Subtitle.bind(null,"- dump the certificate for a check"),
        // execute.bind(null,"openssl x509 -in " + certificate_file + "  -text -noout"),
        execute.bind(null,"openssl x509 -in " + certificate_file + "  -dates -noout"),
        //execute.bind(null,"openssl x509 -in " + certificate_file + "  -purpose -noout"),

        // get certificate fingerprint
        Subtitle.bind(null,"- get certificate fingerprint"),
        execute.bind(null,"openssl x509 -in " + certificate_file + " -noout -fingerprint"),

        constructCACertificateWithCRL.bind(null),
        Subtitle.bind(null,"- verify certificate against the root CA"),
        execute.bind(null,"openssl verify -verbose -CAfile " + caCertificate_With_CRL + " " + certificate_file)
    ];

    async.series(tasks,callback);

}
function createSelfSignCertificate(certname,private_key,applicationUri,startDate,duration,callback) {
     _createCertificate(true,certname,private_key,applicationUri,startDate,duration,callback);
}
function createCertificate(certname,private_key,applicationUri,startDate,duration,callback) {
    _createCertificate(false,certname,private_key,applicationUri,startDate,duration,callback);
}

function get_offset_date(date,nb_days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + nb_days);
    return d;
}

function assert_fileexists(filename) {
    if (!fs.existsSync(path.join(rootDir,filename))) {
        throw new Error(" cannot find file "+ filename);
    }
}


/**
 * reoveke a certificate and update the CRL
 *
 * @method revoke_certificate
 *
 *
 * @param certificate_file
 */
function revoke_certificate(certificate_file, callback) {

    assert(_.isFunction(callback));

    var tasks =[
        Title.bind(null,"Revoking certificate  " + certificate_file),
        Subtitle.bind(null,"Revoke certificate"),

        execute.bind(null,"openssl ca -config " +  "conf/caconfig.cnf" + " -revoke " + certificate_file),
        // regenerate CRL (Certificate Revocation List)
        Subtitle.bind(null,"regenerate CRL (Certificate Revocation List)"),
        execute.bind(null,"openssl ca -gencrl -config " +  "conf/caconfig.cnf" + " -out crl/revocation_list.crl"),

        Subtitle.bind(null,"Display (Certificate Revocation List)"),
        execute.bind(null,"openssl crl -in crl/revocation_list.crl -text -noout"),

        Subtitle.bind(null,"Verify  certificate "),
        execute.bind(null,"openssl verify -verbose -crl_check -CAfile " + "./private/cacert.pem" + " " + certificate_file)

    ];

    async.series(tasks,callback);

}

var today = new Date();

var yesterday = get_offset_date(today,-1);
var two_years_ago = get_offset_date(today,-2*365);
var next_year = get_offset_date(today,365);




function create_default_certificates(done) {

    var base_name = certificateDir;

   //xx var clientURN="urn:NodeOPCUA-Client";
    //xx var serverURN="urn:NodeOPCUA-Server";

    var hostname = get_fully_qualified_domain_name();

    var clientURN="urn:" + hostname +  ":" + "NodeOPCUA-Client";
    var serverURN="urn:" + hostname +  ":" + "NodeOPCUA-Server";
    var task1 = [

        Title.bind(null,"Create  Application Certificate for Server its private key"),
        __create_default_certificates.bind(null,base_name,"client_",clientURN),

        Title.bind(null,"Create  Application Certificate for Client its private key"),
        __create_default_certificates.bind(null,base_name,"server_",serverURN)
    ];
    async.series(task1,done);
}

function __create_default_certificates(base_name,prefix,application_URI,done) {

    assert(_.isFunction(done));

    var key_1024 = make_path(base_name ,prefix + "key_1024.pem");
    var public_key_1024 = make_path(base_name ,prefix + "public_key_1024.pub");
    var key_2048 = make_path(base_name ,prefix + "key_2048.pem");

    console.log(" urn = ",application_URI);

    var tasks1 = [

        createPrivateKey.bind(null,key_1024,1024),

        getPublicKeyFromPrivateKey.bind(null,key_1024,public_key_1024),

        createPrivateKey.bind(null,key_2048,2048),

        createCertificate.bind(null,make_path(base_name ,prefix + "cert_1024.pem"), key_1024,application_URI,yesterday,365),
        createCertificate.bind(null,make_path(base_name ,prefix + "cert_2048.pem"), key_2048,application_URI,yesterday,365),
        createSelfSignCertificate.bind(null,make_path(base_name ,prefix + "selfsigned_cert_1024.pem"), key_1024,application_URI,yesterday,365),
        createSelfSignCertificate.bind(null,make_path(base_name ,prefix + "selfsigned_cert_2048.pem"), key_2048,application_URI,yesterday,365)

    ];

    if (isDevelopment) {
        var tasks2 = [
            createCertificate.bind(null,make_path(base_name ,prefix + "cert_1024_outofdate.pem"), key_1024,application_URI,two_years_ago,365),
            createCertificate.bind(null,make_path(base_name ,prefix + "cert_2048_outofdate.pem"), key_2048,application_URI,two_years_ago,365),

            createCertificate.bind(null,make_path(base_name ,prefix + "cert_1024_not_active_yet.pem"), key_1024,application_URI,next_year,365),
            createCertificate.bind(null,make_path(base_name ,prefix + "cert_2048_not_active_yet.pem"), key_2048,application_URI,next_year,365),

            createCertificate.bind(null,make_path(base_name ,prefix + "cert_1024_revoked.pem"), key_1024,application_URI,yesterday,365),
            revoke_certificate.bind(null,make_path(base_name ,prefix + "cert_1024_revoked.pem")),

            createCertificate.bind(null,make_path(base_name ,prefix + "cert_2048_revoked.pem"), key_2048,application_URI,yesterday,365),
            revoke_certificate.bind(null,make_path(base_name ,prefix + "cert_2048_revoked.pem"))
        ];
        tasks1 = tasks1.concat(tasks2);
    }


    async.series(tasks1,done);

}


function main() {

    async.series([
        construct_CertificateAuthority.bind(null),
        create_default_certificates.bind(null)
    ]);
}

main();


// reference:
// - http://stackoverflow.com/questions/4294689/how-to-generate-a-key-with-passphrase-from-the-command-line
// "-passout pass:foobar"
// "-passout file:foobar.txt"
// "-passout std:in"
//
// - https://jamielinux.com/articles/2013/08/create-and-sign-ssl-certificates-certificate-authority/
// - http://www.systemx.fr/linux/openssl/openssl-p.html
// - http://www.debian-administration.org/article/284/Creating_and_Using_a_self_signed__SSL_Certificates_in_debian
// - https://www.openssl.org/docs/apps/x509v3_config.html
// - https://jamielinux.com/articles/2013/08/generate-certificate-revocation-list-revoke-certificates/
// - https://rietta.com/blog/2012/01/27/openssl-generating-rsa-key-from-command/
