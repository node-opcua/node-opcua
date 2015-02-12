// Create Directory Structure


var colors = require("colors");
var path = require("path");
var fs = require("fs");
var rootDir = path.normalize(path.join(__dirname,"../certificates/ca"));
if (rootDir.indexOf(":") >=0) {
    rootDir = rootDir.split(":")[1];
    rootDir = rootDir.replace(/\\/g,"/");
}

function configurationFile() {
/*
 #.........DO NOT MODIFY BY HAND .........................
 [ ca ]
 default_ca = CA_default

 [ CA_default ]
 dir =  . # %%ROOT_FOLDER%%
 certs = $dir/certs
 crl_dir = $dir/crl
 database = $dir/index.txt
 new_certs_dir = $dir/certs
 certificate = $dir/private/cacert.pem
 serial = $dir/serial
 #crl = $dir/crl.pem
 private_key = $dir/private/cakey.pem
 #RANDFILE = $dir/private/.rand
 x509_extensions = usr_cert
 #crl_extensions = crl_ext
 default_days = 3650
 #default_startdate = YYMMDDHHMMSSZ
 #default_enddate = YYMMDDHHMMSSZ
 #default_crl_days= 30
 #default_crl_hours = 24
 default_md = sha1
 preserve = no
 #msie_hack
 policy = policy_match

 [ policy_match ]
 countryName = optional
 stateOrProvinceName = optional
 localityName = optional
 organizationName = optional
 organizationalUnitName = optional
 commonName = optional
 emailAddress = optional

 [ req ]
 default_bits = 4096 # Size of keys
 default_keyfile = key.pem # name of generated keys
 distinguished_name = req_distinguished_name
 attributes = req_attributes
 x509_extensions = v3_ca
 #input_password
 #output_password
 string_mask = nombstr # permitted characters
 req_extensions = v3_req

 [ req_distinguished_name ]
 countryName = Country Name (2 letter code)
 countryName_default = FR
 countryName_min = 2
 countryName_max = 2
 stateOrProvinceName = State or Province Name (full name)
 stateOrProvinceName_default = Ile de France
 localityName = Locality Name (city, district)
 localityName_default = Paris
 organizationName = Organization Name (company)
 organizationName_default = NodeOPCUA
 organizationalUnitName = Organizational Unit Name (department, division)
 organizationalUnitName_default = R&D
 commonName = Common Name (hostname, FQDN, IP, or your name)
 commonName_max = 64
 commonName_default =
 emailAddress = Email Address
 emailAddress_max = 40
 emailAddress_default = node-opcua (at) node-opcua (dot) com

 [ req_attributes ]
 #challengePassword = A challenege password
 #challengePassword_min = 4
 #challengePassword_max = 20
 #unstructuredName = An optional company name

 [ usr_cert ]
 basicConstraints= CA:FALSE
 subjectKeyIdentifier=hash
 authorityKeyIdentifier=keyid,issuer:always
 #nsComment = ''OpenSSL Generated Certificate''
 #nsCertType = client, email, objsign for ''everything including object signing''
 subjectAltName=email:copy
 issuerAltName=issuer:copy
 #nsCaRevocationUrl = http://www.domain.dom/ca-crl.pem
 #nsBaseUrl =
 #nsRenewalUrl =
 #nsCaPolicyUrl =
 #nsSslServerName =

 [ v3_req ]
 basicConstraints = CA:FALSE
 keyUsage = nonRepudiation, digitalSignature, keyEncipherment
 [ v3_ca ]
 subjectKeyIdentifier = hash
 authorityKeyIdentifier = keyid:always,issuer:always
 basicConstraints = CA:TRUE
 keyUsage = cRLSign, keyCertSign
 #nsCertType = sslCA, emailCA
 #subjectAltName=email:copy
 #issuerAltName=issuer:copy
 #obj=DER:02:03
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
        fs.mkdirSync(folder);
    }
}
function Title(str){
    console.log(str.yellow.bold);
    console.log(new Array(str.length+1).join("=").yellow,"\n");
}
function Subtitle(str){
    console.log(" "+ str.yellow.bold);
    console.log(" "+ new Array(str.length+1).join("-").white,"\n");
}


var child_process = require("child_process");
function execute(cmd,args) {
    args = args||"";
    console.log("   " + cmd.red + " " + args);

    var stdout = child_process.execSync(cmd + " " + args, { cwd: rootDir });
    process.stdout.write(stdout);

}


function construct_CertificateAuthority() {

    // create the CA directory store
    //
    // CA
    //  |
    //  +-+> private
    //  +-+> certs
    //  +-+> conf
    //
    mkdir(rootDir);
    mkdir(path.join(rootDir,"private"));
    //Xx execute("chmod 700 private");

    mkdir(path.join(rootDir,"certs"));
    mkdir(path.join(rootDir,"conf"));

    var serial =path.join(rootDir,"serial");
    if (!fs.existsSync(serial)) {
        fs.writeFileSync(serial,"01");
    }

    var index_file =path.join(rootDir,"index.txt");
    if (!fs.existsSync(index_file)) {
        fs.writeFileSync(index_file,"");
    }
    Title("Create Certificate Authority (CA)");



    var ca_conf =path.join(rootDir,"conf/caconfig.cnf");
    if (1 || !fs.existsSync(ca_conf)) {
        var data = inlineText(configurationFile)
        data = data.replace(/%%ROOT_FOLDER%%/,rootDir);
        fs.writeFileSync(ca_conf,data);
    }

    console.log(" ROOT =",rootDir);

    // http://www.akadia.com/services/ssh_test_certificate.html

    var paraphrase = "qwerty";

    Title("Generate CA Key");
    // The first step is to create your RSA Private Key. This key is a 2048 bit RSA key which is encrypted using
    // Triple-DES and stored in a PEM format so that it is readable as ASCII text.
    execute("openssl genrsa -out private/cakey.pem 2048");
    // execute("chmod 400  private/cakey.pem");


    Title("Generate a certificate request");

    // Once the private key is generated a Certificate Signing Request can be generated.
    // The CSR is then used in one of two ways. Ideally, the CSR will be sent to a Certificate Authority, such as
    // Thawte or Verisign who will verify the identity of the requestor and issue a signed certificate.
    // The second option is to self-sign the CSR, which will be demonstrated in the next section
    var subject  ="/C=FR/ST=IDF/L=Paris/O=Dis/CN=node-opcua.github.io";
    execute("openssl req -new -key private/cakey.pem -out private/cakey.csr -subj '" +subject + "'");

    //Xx // Step 3: Remove Passphrase from Key
    //Xx execute("cp private/cakey.pem private/cakey.pem.org");
    //Xx execute("openssl rsa -in private/cakey.pem.org -out private/cakey.pem -passin pass:"+paraphrase);

    Title("Generate CA Certificate (self-signed)");
    execute("openssl x509 -req -days 3650 -in private/cakey.csr -signkey private/cakey.pem -out private/cacert.pem");
}
function main() {

    construct_CertificateAuthority();

    Title("Create first Application Certificate and its private key");

    var key_file = "my_opcua_server_key.pem";
    var csr_file = "my_opcua_server_csr.pem";
    var certificate_file = "my_opcua_server_certificate.pem";

    var key_length = 1024;
    var key_length = 2048;

    Subtitle(" - the certificate is created first");
    {
        execute("openssl genrsa -out " + key_file + " " + key_length);
    }

    Subtitle(" - the certificate signing request");
    {
        execute("openssl req -config " + "conf/caconfig.cnf" + " -batch -new -key " +key_file + " -out " + csr_file);
    }

    Subtitle(" - then we ask the authority to sign the certificate signing request");
    {
        execute("openssl ca -config " + "conf/caconfig.cnf" + " -batch -out "  + certificate_file +  " -in "+ csr_file);
    }


    Subtitle(" - dump the certificate for a check");
    {

    }
        //
        execute("openssl x509 -in " + certificate_file + "  -text -noout");

       execute("openssl x509 -in " + certificate_file + "  -dates -noout");
       execute("openssl x509 -in " + certificate_file + "  -purpose -noout");

    // you can also use openssl to verify the certificate against your root CA:
    // -batch

    // openssl x509 -in cacert.pem -noout -text
    // openssl x509 -in cacert.pem -noout -dates
    // openssl x509 -in cacert.pem -noout -purpose



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
