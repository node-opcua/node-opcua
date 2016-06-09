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
require("requirish")._(module);
var colors = require("colors");
var path = require("path");
var fs = require("fs");
var child_process = require("child_process");
var async = require("async");
var _ = require("underscore");
var assert = require("better-assert");
var byline = require('byline');


var argv = require('yargs')
    .usage('Usage: $0 [--dev] [--silent] [--force]')
    .boolean("force")
    .boolean("forceCA")
    .boolean("dev")
    .boolean("silent")
    .string("applicationUri")
    .string("prefix")
    .boolean("selfSigned")
    .string("privateKey")
    .argv;


// ---------------------------------------------------------------------------------------------------------------------
var default_config          = path.join(__dirname,path.basename(__filename,".js") + "_config.js");
var default_config_template = path.join(__dirname,path.basename(__filename,".js") + "_config.example.js");
if (!fs.existsSync(default_config) && fs.existsSync(default_config_template))  {
    // copy
    console.log(" Creating default config file ",default_config);
    fs.writeFileSync(default_config,fs.readFileSync(default_config_template));
}

var config = require(default_config);
// ---------------------------------------------------------------------------------------------------------------------




function setEnv(varName,value) {
    console.log("          set " + varName + " =" + value);
    process.env[varName] = value;
}

process.env.ALTNAME_URI = process.env.ALTNAME_URI || "";
process.env.ALTNAME_DNS = process.env.ALTNAME_DNS || "";
process.env.ALTNAME_DNS_1 = process.env.ALTNAME_DNS_1 || "";
process.env.ALTNAME_DNS_2 = process.env.ALTNAME_DNS_2 || "";

var configOption = " -config conf/caconfig.cnf ";
configOption = "";

var force = argv.force;
var forceCA = argv.forceCA;

var openssl_path = "openssl";

var isDevelopment = argv.dev;


var get_fully_qualified_domain_name = require("lib/misc/hostname").get_fully_qualified_domain_name;
var hostname = require("os").hostname();

var makeApplicationUrn = require("lib/misc/applicationurn").makeApplicationUrn;

function make_path(folder_name, file_name) {
    folder_name = folder_name.replace(/\"/g, "");
    var s = path.join(path.normalize(folder_name), file_name);
    s = s.replace(/\\/g, "/");
    s = s.replace(/\"/g, "");

    return s;
}

var certificateDir = make_path(__dirname, "../certificates/");

var pkiDir = make_path(certificateDir, "PKI");
var rootDir = make_path(pkiDir, "CA");

// the Certificate Authority Certificate
var cacert_filename = path.join(rootDir, "./public/cacert.pem");

// The Certificate Authority Revocation List
var crl_filename = path.join(rootDir, "./crl/revocation_list.crl");

function configurationFile() {
    /*
     #.........DO NOT MODIFY BY HAND .........................
     [ ca ]
     default_ca               = CA_default

     [ CA_default ]
     dir                      = %%ROOT_FOLDER%%            # the main CA folder
     certs                    = $dir/certs                 # where to store certificates
     new_certs_dir            = $dir/certs                 #
     database                 = $dir/index.txt             # the certificate database
     serial                   = $dir/serial                # the serial number counter
     certificate              = $dir/public/cacert.pem     # The root CA certificate
     private_key              = $dir/private/cakey.pem     # the CA private key

     x509_extensions          = usr_cert                   #
     default_days             = 3650                       # default duration : 10 years

     # default_md               = sha1
     default_md                 = sha256                      # The default digest algorithm

     preserve                 = no
     policy                   = policy_match

     RANDFILE                 = $dir/private/randfile
     # default_startdate        = YYMMDDHHMMSSZ
     # default_enddate          = YYMMDDHHMMSSZ

     crl_dir                  = $dir/crl
     crl_extensions           = crl_ext
     crl                      = $dir/revocation_list.crl # the Revocation list
     crlnumber                = $dir/crlnumber           # CRL number file
     default_crl_days         = 30
     default_crl_hours        = 24
     #msie_hack

     [ policy_match ]
     countryName              = optional
     stateOrProvinceName      = optional
     localityName             = optional
     organizationName         = optional
     organizationalUnitName   = optional
     commonName               = optional
     emailAddress             = optional

     [ req ]
     default_bits             = 4096                     # Size of keys
     default_keyfile          = key.pem                  # name of generated keys
     distinguished_name       = req_distinguished_name
     attributes               = req_attributes
     x509_extensions          = v3_ca
     #input_password
     #output_password
     string_mask              = nombstr                  # permitted characters
     req_extensions           = v3_req

     [ req_distinguished_name ]
     # countryName             = Country Name (2 letter code)
     # countryName_default     = FR
     # countryName_min         = 2
     # countryName_max         = 2
     # stateOrProvinceName     = State or Province Name (full name)
     # stateOrProvinceName_default = Ile de France
     # localityName            = Locality Name (city, district)
     # localityName_default    = Paris
     organizationName          = Organization Name (company)
     organizationName_default  = NodeOPCUA
     # organizationalUnitName  = Organizational Unit Name (department, division)
     # organizationalUnitName_default = R&D
     commonName                = Common Name (hostname, FQDN, IP, or your name)
     commonName_max            = 64
     commonName_default        = NodeOPCUA
     # emailAddress            = Email Address
     # emailAddress_max        = 40
     # emailAddress_default    = node-opcua (at) node-opcua (dot) com

     [ req_attributes ]
     #challengePassword        = A challenge password
     #challengePassword_min    = 4
     #challengePassword_max    = 20
     #unstructuredName         = An optional company name

     [ usr_cert ]
     basicConstraints          = critical, CA:FALSE
     subjectKeyIdentifier      = hash
     authorityKeyIdentifier    = keyid,issuer:always
     #authorityKeyIdentifier    = keyid
     subjectAltName            = @alt_names
     # issuerAltName            = issuer:copy
     nsComment                 = ''OpenSSL Generated Certificate''
     #nsCertType               = client, email, objsign for ''everything including object signing''
     #nsCaRevocationUrl        = http://www.domain.dom/ca-crl.pem
     #nsBaseUrl                =
     #nsRenewalUrl             =
     #nsCaPolicyUrl            =
     #nsSslServerName          =
     keyUsage                  = critical, digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment, keyAgreement, keyCertSign
     extendedKeyUsage          = critical,serverAuth ,clientAuth

     [ v3_req ]
     basicConstraints          = critical, CA:FALSE
     keyUsage                  = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyAgreement
     # subjectAltName            = $ENV::ALTNAME
     subjectAltName            = @alt_names
     nsComment                 = "CA Generated by Node-OPCUA Certificate utility using openssl"

     [ alt_names ]
     URI                       = $ENV::ALTNAME_URI
     DNS.0                     = $ENV::ALTNAME_DNS
     DNS.1                     = $ENV::ALTNAME_DNS_1

     [ v3_ca ]
     subjectKeyIdentifier      = hash
     authorityKeyIdentifier    = keyid:always,issuer:always
     # authorityKeyIdentifier    = keyid
     basicConstraints          = CA:TRUE
     keyUsage                  = critical, cRLSign, keyCertSign
     nsComment                 = "CA Certificate generated by Node-OPCUA Certificate utility using openssl"
     #nsCertType                 = sslCA, emailCA
     #subjectAltName             = email:copy
     #issuerAltName              = issuer:copy
     #obj                        = DER:02:03
     crlDistributionPoints     = @crl_info

     [ crl_info ]
     URI.0                     = http://localhost:8900/crl.pem

     [ v3_selfsigned]
     basicConstraints          = critical, CA:FALSE
     keyUsage                  = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyAgreement
     nsComment                 = "Self-signed certificate"
     subjectAltName            = @alt_names

     [ crl_ext ]
     #issuerAltName            = issuer:copy
     authorityKeyIdentifier    = keyid:always,issuer:always
     #authorityInfoAccess       = @issuer_info

     */
}
function inlineText(f) {
    return f.toString().
        replace(/^[^\/]+\/\*!?/, '').
        replace(/\*\/[^\/]+$/, '');
}

function mkdir(folder) {
    if (!fs.existsSync(folder)) {
        console.log(" .. constructing ".white, folder);
        fs.mkdirSync(folder);
    }
}

function displayTitle(str, option_callback) {

    if (!argv.silent) {
        console.log("");
        console.log(str.yellow.bold);
        console.log(new Array(str.length + 1).join("=").yellow, "\n");
    }
    if (option_callback) {
        option_callback();
    }
}

function displaySubtitle(str, option_callback) {

    if (!argv.silent) {
        console.log("");
        console.log("    " + str.yellow.bold);
        console.log("    " + new Array(str.length + 1).join("-").white, "\n");
    }
    if (option_callback) {
        option_callback();
    }
}


setEnv("OPENSSL_CONF",make_path(rootDir,"conf/caconfig.cnf"));

var displayError = true;

function execute(cmd, callback) {

    assert(_.isFunction(callback));

    if (!argv.silent) {
        console.log("    " + cmd.cyan.bold);
    }
    var child = child_process.exec(cmd, {cwd: rootDir}, function (err) {
        callback(err);
    });

    if (!argv.silent) {
        var stream1 = byline(child.stderr);
        stream1.on('data', function (line) {
            if (displayError) {
                line  = line.toString();
                process.stdout.write("        err " + line.red + "\n");
            }
        });
        var stream2 = byline(child.stdout);
        stream2.on('data', function (line) {
            line  = line.toString();
            process.stdout.write("        out " + line.white.bold + "\n");
        });
    }
}

function execute_no_failure(cmd, callback) {
    execute(cmd, function (err) {
        if (err) {
            console.log(" ERROR : ",err.message);
        }
        callback(null);
    });
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
    mkdir(path.join(rootDir, "private"));
    mkdir(path.join(rootDir, "public"));
    //Xx execute("chmod 700 private");

    mkdir(path.join(rootDir, "certs"));
    mkdir(path.join(rootDir, "crl"));
    mkdir(path.join(rootDir, "conf"));

    var serial = path.join(rootDir, "serial");
    if (!fs.existsSync(serial)) {
        fs.writeFileSync(serial, "1000");
    }

    var crlnumber = path.join(rootDir, "crlnumber");
    if (!fs.existsSync(crlnumber)) {
        fs.writeFileSync(crlnumber, "1000");
    }

    var index_file = path.join(rootDir, "index.txt");
    if (!fs.existsSync(index_file)) {
        fs.writeFileSync(index_file, "");
    }

    if (fs.existsSync(path.join(rootDir, "private/cakey.pem")) && !forceCA) {
        // certificate already exists => do not overwrite
        console.log("CA private key already exists ... skipping");
        return done();
    }

    displayTitle("Create Certificate Authority (CA)");

    var index_file_attr = path.join(rootDir, "index.txt.attr");
    if (!fs.existsSync(index_file_attr)) {
        fs.writeFileSync(index_file_attr, "unique_subject = no");
    }

    var ca_conf = path.join(rootDir, "conf/caconfig.cnf");
    if (1 || !fs.existsSync(ca_conf)) {
        var data = inlineText(configurationFile);
        data = data.replace(/%%ROOT_FOLDER%%/, rootDir);
        fs.writeFileSync(ca_conf, data);
    }


    console.log(" ROOT =", rootDir);

    // http://www.akadia.com/services/ssh_test_certificate.html

    var subject = "/C=FR/ST=IDF/L=Paris/O=Fake CA for Test/CN=NodeOPCUA";

    process.env.ALTNAME_URI = "";
    process.env.ALTNAME_DNS = "";
    process.env.ALTNAME_DNS_1 = "";

    var tasks = [

        displayTitle.bind(null, "Generate the CA private Key"),
        // The first step is to create your RSA Private Key. This key is a 2048 bit RSA key which is encrypted using
        // Triple-DES and stored in a PEM format so that it is readable as ASCII text.
        execute.bind(null, openssl_path + " genrsa -out private/cakey.pem 2048"),

        displayTitle.bind(null, "Generate a certificate request for the CA key"),
        // Once the private key is generated a Certificate Signing Request can be generated.
        // The CSR is then used in one of two ways. Ideally, the CSR will be sent to a Certificate Authority, such as
        // Thawte or Verisign who will verify the identity of the requestor and issue a signed certificate.
        // The second option is to self-sign the CSR, which will be demonstrated in the next section
        execute.bind(null, openssl_path + " req -new" +
            " -text " +
            " -extensions v3_ca" +
            configOption +
            " -key private/cakey.pem " +
            " -out private/cakey.csr " +
            " -subj \"" + subject + "\""),

        //Xx // Step 3: Remove Passphrase from Key
        //Xx execute("cp private/cakey.pem private/cakey.pem.org");
        //Xx execute(openssl_path + " rsa -in private/cakey.pem.org -out private/cakey.pem -passin pass:"+paraphrase);

        displayTitle.bind(null, "Generate CA Certificate (self-signed)"),
        execute.bind(null, openssl_path + " x509 -req -days 3650 " +
            " -text " +
            " -extensions v3_ca" +
            " -extfile " + "conf/caconfig.cnf" +
            " -in private/cakey.csr " +
            " -signkey private/cakey.pem " +
            " -out public/cacert.pem"),

        displaySubtitle.bind(null, "generate CRL (Certificate Revocation List)"),
        execute.bind(null, openssl_path + " ca -gencrl " + configOption + " -out crl/revocation_list.crl"),
    ];


    async.series(tasks, done);

}

function x509Date(date) {

    var Y = date.getUTCFullYear() - 2000;
    var M = date.getUTCMonth() + 1;
    var D = date.getUTCDate();
    var h = date.getUTCHours();
    var m = date.getUTCMinutes();
    var s = date.getUTCSeconds();

    function w(s, l) {
        return ("00000" + s).substr(-l, l);
    }

    return w(Y, 2) + w(M, 2) + w(D, 2) + w(h, 2) + w(m, 2) + w(s, 2) + "Z";

}

var caCertificate_With_CRL = path.join(rootDir,"cacertificate_with_crl.pem");

function constructCertificateChain(self_signed,certificate_file,callback) {
    assert(_.isFunction(callback));

    if (self_signed) {
        return callback(); // nothing to do
    }
    console.log("        certificate file :".yellow,certificate_file.cyan);
    assert(fs.existsSync(certificate_file));
    assert(fs.existsSync(cacert_filename));
    // append
    fs.writeFileSync(certificate_file,
        fs.readFileSync(certificate_file)
        + fs.readFileSync(cacert_filename)
        //xx + fs.readFileSync(crl_filename)
    );
    callback();
}


function constructCACertificateWithCRL(callback) {

    assert(_.isFunction(callback));

    var cacert_with_crl = caCertificate_With_CRL;

    // note : in order to check if the certificate is revoked,
    // you need to specify -crl_check and have both the CA cert and the (applicable) CRL in your truststore.
    // There are two ways to do that:
    // 1. concatenate cacert.pem and crl.pem into one file and use that for -CAfile.
    // 2. use some linked
    // ( from http://security.stackexchange.com/a/58305/59982)

    if (fs.existsSync(crl_filename)) {
        fs.writeFileSync(cacert_with_crl, fs.readFileSync(cacert_filename) + fs.readFileSync(crl_filename));
    } else {
        // there is no revocation list yet
        fs.writeFileSync(cacert_with_crl, fs.readFileSync(cacert_filename));
    }
    console.log("        cacert_with_crl = ",cacert_with_crl);
    callback();
}

/**
 * create a RSA PRIVATE KEY
 *
 * @method createPrivateKey
 *
 * @param private_key_filename
 * @param key_length
 * @param callback {Function}
 */
function createPrivateKey(private_key_filename, key_length, callback) {

    assert([1024, 2048, 4096].indexOf(key_length) >= 0);
    if (fs.existsSync(private_key_filename)) {
        if (force) {
            console.log("private key ", private_key_filename, "  exists => deleted");
            fs.unlinkSync(private_key_filename);
        } else {
            console.log("private key ", private_key_filename, " already exists ");
            return callback();
        }
    }
    execute(openssl_path + " genrsa -out " + quote(private_key_filename) + " " + key_length, callback);
}


/**
 * extract public key from private key
 *   openssl rsa -pubout -in private_key.pem
 *
 * @method getPublicKeyFromPrivateKey
 * @param private_key_filename
 * @param public_key_filename
 * @param callback  {Function}
 */
function getPublicKeyFromPrivateKey(private_key_filename, public_key_filename, callback) {
    execute(openssl_path + " rsa -pubout -in " + quote(private_key_filename) + " > " + quote(public_key_filename), callback);
}

/**
 * extract public key from a certificate
 *   openssl x509 -pubkey -in certificate.pem -nottext
 *
 * @method getPublicKeyFromCertificate
 * @param certificate_filename
 * @param public_key_filename
 * @param callback
 */
function getPublicKeyFromCertificate(certificate_filename, public_key_filename, callback) {
    execute(openssl_path + " x509 -pubkey -in" + quote(certificate_filename) + " -notext  > " + quote(public_key_filename), callback);
}


function renew_certificate(certificate, new_startDate, new_endDate, callback) {

    async.series([
        displaySubtitle.bind(null, "renew_certificate"),

        execute.bind(null, openssl_path + " ca " + configOption +
            " -policy policy_anything " +
            " -out newcert.pem " +
            " -infiles newreq.pem " +
            " -startdate  " + new_startDate +
            " -enddate " + new_endDate)
    ], callback);

}

/**
 * create a certificate issued by the Certification Authority
 * @method createCertificate
 * @param self_signed
 * @param certname
 * @param private_key
 * @param applicationUri
 * @param startDate
 * @param duration
 * @param callback
 */
function _createCertificate(self_signed, certname, private_key, applicationUri, startDate, duration, callback) {

    assert(_.isFunction(callback));
    duration = duration || 365; // one year

    assert(typeof certname === "string");
    assert(typeof private_key === "string");
    assert(typeof applicationUri === "string");
    assert(applicationUri.length <= 64, "Openssl doesn't support urn with length greater than 64 ");
    assert(startDate instanceof Date);

    startDate = startDate || new Date();

    var endDate = new Date(startDate.getTime());
    endDate.setDate(startDate.getDate() + duration);

    startDate = x509Date(startDate);
    endDate = x509Date(endDate);

    var csr_file = certname + "_csr";
    var certificate_file = certname;

    if (fs.existsSync(certificate_file) && !force) {
        console.log("        certificate ".yellow + certificate_file.cyan + " already exists => do not overwrite".yellow);
        return callback();
    }

    // applicationUri
    setEnv("ALTNAME_URI",applicationUri);
    // the list of HostName
    setEnv("ALTNAME_DNS", "localhost");
    setEnv("ALTNAME_DNS_1",  get_fully_qualified_domain_name());

    var sign_certificate = function () {
    };
    if (self_signed) {
        sign_certificate = [
            displaySubtitle.bind(null, "- creating the self signed certificate"),
            execute.bind(null, openssl_path + " ca " + configOption +
                " -selfsign " +
                " -keyfile " + quote(private_key) +
                " -startdate " + startDate +
                " -enddate " + endDate +
                " -batch -out " + quote(certificate_file) + " -in " + quote(csr_file))
        ];

    } else {

        sign_certificate = [
            displaySubtitle.bind(null, "- then we ask the authority to sign the certificate signing request"),
            execute.bind(null, openssl_path + " ca " + configOption +
                " -startdate " + startDate +
                " -enddate " + endDate +
                " -batch -out " + quote(certificate_file) + " -in " + quote(csr_file))
        ];
    }
    var tasks = [

        displaySubtitle.bind(null, "- the certificate signing request"),
        execute.bind(null, openssl_path + " req -text " + configOption + " -batch -new -key " + quote(private_key) + " -out " + quote(csr_file)),

        sign_certificate[0],
        sign_certificate[1],

        displaySubtitle.bind(null, "- dump the certificate for a check"),
        // execute.bind(null,openssl_path + " x509 -in " + certificate_file + "  -text -noout"),
        execute.bind(null, openssl_path + " x509 -in " + quote(certificate_file) + "  -dates -noout"),
        //execute.bind(null,openssl_path + " x509 -in " + quote(certificate_file) + "  -purpose -noout"),

        // get certificate fingerprint
        displaySubtitle.bind(null, "- get certificate fingerprint"),
        execute.bind(null, openssl_path + " x509 -in " + quote(certificate_file) + " -noout -fingerprint"),

        displaySubtitle.bind(null, "- construct CA certificate with CRL"),
        constructCACertificateWithCRL.bind(null),

        // construct certificate chain
        //   concatenate certificate with CA Certificate and revocation list
        displaySubtitle.bind(null, "- construct certificate chain"),
        constructCertificateChain.bind(null,self_signed,certificate_file)
    ];

    if (self_signed) {
        tasks.push(displaySubtitle.bind(null, "- verify self-signed certificate"));
        tasks.push(execute_no_failure.bind(null, openssl_path + " verify -verbose -CAfile " + quote(certificate_file) + " " + quote(certificate_file)));
    } else {
        tasks.push(displaySubtitle.bind(null, "- verify certificate against the root CA"));
        tasks.push(execute_no_failure.bind(null, openssl_path + " verify -verbose -CAfile " + quote(caCertificate_With_CRL) + " " + quote(certificate_file)));
    }

    async.series(tasks, callback);

}
function createSelfSignCertificate(certname, private_key, applicationUri, startDate, duration, callback) {
    _createCertificate(true, certname, private_key, applicationUri, startDate, duration, callback);
}
function createCertificate(certname, private_key, applicationUri, startDate, duration, callback) {
    _createCertificate(false, certname, private_key, applicationUri, startDate, duration, callback);
}

function get_offset_date(date, nb_days) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + nb_days);
    return d;
}

function assert_fileexists(filename) {
    if (!fs.existsSync(path.join(rootDir, filename))) {
        throw new Error(" cannot find file " + filename);
    }
}


/**
 * reoveke a certificate and update the CRL
 *
 * @method revoke_certificate
 *
 *
 * @param certificate_file
 * @param callback
 * @async
 */
function revoke_certificate(certificate_file, callback) {

    assert(_.isFunction(callback));
    var crlReasons = [
        "unspecified", "keyCompromise", "CACompromise", "affiliationChanged", "superseded", "cessationOfOperation", "certificateHold","removeFromCRL"
    ];

    var tasks = [
        displayTitle.bind(null, "Revoking certificate  " + certificate_file),
        displaySubtitle.bind(null, "Revoke certificate"),

        // -crl_reason reason
        execute_no_failure.bind(null, openssl_path + " ca "+ configOption + " -revoke " + quote(certificate_file) + " -crl_reason keyCompromise"),
        // regenerate CRL (Certificate Revocation List)
        displaySubtitle.bind(null, "regenerate CRL (Certificate Revocation List)"),
        execute.bind(null, openssl_path + " ca -gencrl " + configOption + " -out crl/revocation_list.crl"),

        displaySubtitle.bind(null, "Display (Certificate Revocation List)"),
        execute.bind(null, openssl_path + " crl -in crl/revocation_list.crl -text -noout"),

        displaySubtitle.bind(null, "Verify  certificate "),
        execute_no_failure.bind(null, openssl_path + " verify -verbose -CRLfile " + "crl/revocation_list.crl" + " -crl_check -CAfile " + "./public/cacert.pem" + " " + quote(certificate_file)),

        // produce CRL in DEF format
        displaySubtitle.bind(null, "Produce CRL in DER form "),
        execute.bind(null, openssl_path + " crl -in crl/revocation_list.crl -out  crl/revocation_list.der -outform der")
    ];

    async.series(tasks, callback);

}

var today = new Date();

var yesterday = get_offset_date(today, -1);
var two_years_ago = get_offset_date(today, -2 * 365);
var next_year = get_offset_date(today, 365);


function create_default_certificates(done) {

    var base_name = certificateDir;

    var hostname = get_fully_qualified_domain_name();
    console.log(" hostname = ", hostname);

    var clientURN = makeApplicationUrn(hostname, "NodeOPCUA-Client");
    var serverURN = makeApplicationUrn(hostname, "NodeOPCUA-Server");
    var discoveryServerURN = makeApplicationUrn(hostname, "NodeOPCUA-DiscoveryServer");

    var task1 = [

        displayTitle.bind(null, "Create  Application Certificate for Server & its private key"),
        __create_default_certificates.bind(null, base_name, "client_", clientURN),

        displayTitle.bind(null, "Create  Application Certificate for Client & its private key"),
        __create_default_certificates.bind(null, base_name, "server_", serverURN),

        displayTitle.bind(null, "Create  Application Certificate for DiscoveryServer & its private key"),
        __create_default_certificates.bind(null, base_name, "discoveryServer_", discoveryServerURN)

    ];
    async.series(task1, done);
}

function __create_default_certificates(base_name, prefix, applicationUri, done) {

    // Bad hack that ensures that paths with spaces are correctly interpreted.
    base_name = "\"" + base_name + "\"";

    assert(_.isFunction(done));

    var key_1024 = make_path(base_name, prefix + "key_1024.pem");
    var public_key_1024 = make_path(base_name, prefix + "public_key_1024.pub");
    var key_2048 = make_path(base_name, prefix + "key_2048.pem");

    console.log(" urn = ", applicationUri);

    var tasks1 = [

        createPrivateKey.bind(null, key_1024, 1024),

        getPublicKeyFromPrivateKey.bind(null, key_1024, public_key_1024),

        createPrivateKey.bind(null, key_2048, 2048),

        createCertificate.bind(null, make_path(base_name, prefix + "cert_1024.pem"), key_1024, applicationUri, yesterday, 365),
        createCertificate.bind(null, make_path(base_name, prefix + "cert_2048.pem"), key_2048, applicationUri, yesterday, 365),

        createSelfSignCertificate.bind(null, make_path(base_name, prefix + "selfsigned_cert_1024.pem"), key_1024, applicationUri, yesterday, 365),
        createSelfSignCertificate.bind(null, make_path(base_name, prefix + "selfsigned_cert_2048.pem"), key_2048, applicationUri, yesterday, 365)

    ];

    if (isDevelopment) {
        var tasks2 = [
            createCertificate.bind(null, make_path(base_name, prefix + "cert_1024_outofdate.pem"), key_1024, applicationUri, two_years_ago, 365),
            createCertificate.bind(null, make_path(base_name, prefix + "cert_2048_outofdate.pem"), key_2048, applicationUri, two_years_ago, 365),

            createCertificate.bind(null, make_path(base_name, prefix + "cert_1024_not_active_yet.pem"), key_1024, applicationUri, next_year, 365),
            createCertificate.bind(null, make_path(base_name, prefix + "cert_2048_not_active_yet.pem"), key_2048, applicationUri, next_year, 365),

            createCertificate.bind(null, make_path(base_name, prefix + "cert_1024_revoked.pem"), key_1024, applicationUri, yesterday, 365),
            revoke_certificate.bind(null, make_path(base_name, prefix + "cert_1024_revoked.pem")),

            createCertificate.bind(null, make_path(base_name, prefix + "cert_2048_revoked.pem"), key_2048, applicationUri, yesterday, 365),
            revoke_certificate.bind(null, make_path(base_name, prefix + "cert_2048_revoked.pem"))
        ];
        tasks1 = tasks1.concat(tasks2);
    }


    async.series(tasks1, done);

}

var install_prerequisite = require("./install_prerequisite").install_prerequisite;

function quote(str) {
    return "\"" + str + "\"";
}
function find_openssl(callback) {

    if (process.platform === "win32") {
        openssl_path = quote(path.join(__dirname, "./openssl/openssl.exe"));
    }
    callback(null);

}
function createDefaultCertificates() {

    async.series([
        install_prerequisite.bind(null),
        find_openssl.bind(null),
        construct_CertificateAuthority.bind(null),
        create_default_certificates.bind(null)
    ], function (err) {
        if (err) {
            console.log("ERROR ".red, err.message);
        }
    });
}


/**
 *
 * @param options
 * @param options.commonName       {String}
 * @param options.organization     {String}
 * @param options.organizationUnit {String}
 * @param options.locality         {String}
 * @param options.state            {String}
 * @param options.country          {String}
 *
 * @param options.applicationUri   {Numbers}
 * @param options.domainNames      {Array<String>}
 * @param options.ipAddresses      {Array<String>}
 * @param options.keySize          {Numbers}
 *
 * @param options.startDate        {Date}= today
 * @param options.validity         {Number} number of days for validation [15*360 =15 years]
 * @param options.selfSigned       {Boolean}
 *
 * @param options.prefix           {String} "new_certificate";
 *
 * @param options.privateKey       {String} the privateKey filename or null, if private key need to be generated
 * @param callback {Function}
 */
function createNewCertificate(options,callback ) {

    assert(_.isFunction(callback));


    var tasks = [
        install_prerequisite.bind(null),
        find_openssl.bind(null),
        construct_CertificateAuthority.bind(null)
    ];


    var base_name =  make_path(__dirname, "../certificates/");

    // -----------------------------------------------------------------------------
    // Subject
    // -----------------------------------------------------------------------------
    options.commonName       = options.commonName       || config.commonName;
    options.organization     = options.organization     || config.organization;
    options.organizationUnit = options.organizationUnit || config.organizationUnit;
    options.locality         = options.locality         || config.locality;
    options.state            = options.state            || config.state;
    options.country          = options.country          || config.country;

    assert(options.country.length === 2);

    // -----------------------------------------------------------------------------
    // OPCUA Information
    // -----------------------------------------------------------------------------
    options.applicationUri = options.applicationUri || makeApplicationUrn(hostname, "NodeOPCUA-Client");
    options.domainNames   = [
        "localhost"
    ];
    options.ipAddresses = options.ipAddresses || [];

    // -----------------------------------------------------------------------------
    // Certificate settings
    // -----------------------------------------------------------------------------
    options.keySize = options.keySize || config.keySize; // bits
    assert(options.keySize === 1024 || options.keySize === 2048 || options.keySize === 4096);
    options.validity = options.validity || config.validity;

    options.selfSigned = !!(options.selfSigned);
    options.startDate = options.startDate || today;

    assert(options.startDate instanceof Date);
    assert(_.isNumber(options.validity));


    var private_key;

    if (options.privateKey) {

        options.privateKey = make_path(process.cwd(),options.privateKey);

        if (!fs.existsSync(options.privateKey)) {
            throw new Error("Cannot find public key ",options.privateKey);
        }
        private_key  = options.privateKey;
        console.log("          reusing private key : ",private_key);

    } else {
        options.prefix = options.prefix || "new_certificate_XX";
        private_key  = make_path(base_name, options.prefix +  "_private_key.pem");

        tasks.push(createPrivateKey.bind(null, private_key, options.keySize));
    }

    var certificate  =  make_path(base_name, options.prefix + "_certificate.pem");


    //xx getPublicKeyFromPrivateKey.bind(null, private_key, public_key),
    tasks = tasks.concat([

        _createCertificate.bind(null,options.selfSigned ,certificate, private_key,options.applicationUri,options.startDate,options.validity),

        displayTitle.bind(null, " Result"),

        function(callback) {

            console.log("  private key : ",private_key.cyan);
            //xx console.log("  public  key : ", public_key.cyan);
            console.log("  certificate : ",certificate.cyan);
            callback();
        }
    ]);
    async.series(tasks, callback);
}

function createCertificateFromCommandLine() {

    //example : node bin\crypto_create_CA.js --new --selfSigned --applicationUri urn:localhost:MyProduct --prefix aa --force

    assert(_.isString(argv.applicationUri));
    // urn:COMPUTERNAME:PRODUCT

    assert(argv.applicationUri.length < 64);
    var options = {
        applicationUri: argv.applicationUri || makeApplicationUrn(get_fully_qualified_domain_name(), "NodeOPCUA-Server")
    };

    assert(_.isString(argv.prefix));
    options.prefix = argv.prefix;
    options.privateKey = argv.privateKey;
    options.selfSigned = argv.selfSigned;

    createNewCertificate(options,function(){
        console.log("Done ...");
    });
}


if (argv.new) {
    createCertificateFromCommandLine();

} else {
    createDefaultCertificates();
}

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
// - http://stackoverflow.com/questions/16658038/cant-open-config-file-usr-local-ssl-openssl-cnf-on-windows²