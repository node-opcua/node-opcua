"use strict";
require("requirish")._(module);
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var should = require("should");
var colors = require("colors");
var assert = require("assert");

var utils = require("lib/misc/utils");
var loremIpsum = require("test/helpers/lorem_ipsum").loremIpsum;

var crypto_utils = require("lib/misc/crypto_utils");


var old_store = null;
function switch_to_test_certificate_store() {
    assert(old_store === null);
    old_store = crypto_utils.setCertificateStore(path.join(__dirname,"../fixtures/certs/"));
}
function restore_default_certificate_store() {
    assert(old_store !== null);
    crypto_utils.setCertificateStore(old_store);
    old_store = null;

}

var alice_private_key_filename = path.join(__dirname,"../fixtures/certs/server_key_1024.pem");
var alice_public_key_filename  = path.join(__dirname,"../fixtures/certs/server_public_key_1024.pub");
var alice_certificate_filename = path.join(__dirname,"../fixtures/certs/server_cert_1024.pem");


var doDebug = false;
//Xx doDebug = true;
function debugLog() {
    if (doDebug) {
        console.log.apply(console, arguments);
    }
}


// symmetric encryption and decryption
function encrypt_buffer(buffer, algorithm, key) {
    var crypto = require("crypto");
    var cipher = crypto.createCipher(algorithm, key);
    var encrypted_chunks = [];
    encrypted_chunks.push(cipher.update(buffer));
    encrypted_chunks.push(cipher.final());

    return Buffer.concat(encrypted_chunks);
}

function decrypt_buffer(buffer, algorithm, key) {
    var crypto = require("crypto");
    var decipher = crypto.createDecipher(algorithm, key);
    var decrypted_chunks = [];
    decrypted_chunks.push(decipher.update(buffer));
    decrypted_chunks.push(decipher.final());
    return Buffer.concat(decrypted_chunks);
}





var read_sshkey_as_pem = crypto_utils.read_sshkey_as_pem;
var read_private_rsa_key = crypto_utils.read_private_rsa_key;


//  ursa only work with node version <= 0.10
//  however crypto.publicEncrypt only appear in node > 0.11.14
//describe("testing publicEncrypt / privateDecrypt native and ursa",function(){
//
//    it("publicEncrypt_native and  privateDecrypt_native" ,function(){
//
//        var bob_public_key  = read_sshkey_as_pem('bob_id_rsa.pub');
//
//        var message = new Buffer("Hello World");
//
//        var encrypted_native =  publicEncrypt_native(message,bob_public_key);
//        var encrypted_ursa   =  publicEncrypt_ursa(message,bob_public_key);
//
//        encrypted_native.should.eql(encrypted_ursa);
//
//    });
//
//});


//describe("testing RSA_PKCS1_V15 asymmetric encryption", function() {
//
//    it("should encrypt and decrypt with RSA_PKCS1_V15",function(){
//        var algorithm = "RSA-PKCS1-V15";
//        var bob_public_key     = read_sshkey_as_pem('bob_id_rsa.pub');
//
//        var message = "Hello World";
//
//        var encrypted_message = encrypt_buffer(message,algorithm ,bob_public_key);
//
//        var bob_private_key = read_private_rsa_key('bob_id_rsa');
//        var decrypted_message = decrypt_buffer(encrypted_message,algorithm,bob_private_key);
//
//        decrypted_message.should.eql(message);
//
//    });
//});


describe("testing and exploring the NodeJS crypto api", function () {


    beforeEach(function(done){switch_to_test_certificate_store();done();});
    afterEach(function(done){restore_default_certificate_store();done();});


    it("should be possible to sign a message and verify the signature of a message", function () {

        // ------------------- this is Alice
        //
        // alice want to send a message to Bob
        var message = "HelloWorld";

        // alice will sign her message to bob with her private key.
        var alice_private_key_pem = fs.readFileSync(alice_private_key_filename);
        var alice_private_key = alice_private_key_pem.toString('ascii');
        debugLog(alice_private_key);

        var signature = crypto.createSign("RSA-SHA256").update(message).sign(alice_private_key);

        debugLog("message   = ", message);
        debugLog("signature = ", signature.toString("hex"));


        // ------------------- this is Bob
        // Bob has received a message from Alice,
        // He wants to verify that the message is really from by Alice.
        // Alice has given Bob her public_key.
        // Bob uses Alice's public key to verify that the message is correct

        var message_from_alice = "HelloWorld";

        var alice_public_key = fs.readFileSync(alice_public_key_filename,'ascii');

         crypto.createVerify("RSA-SHA256")
               .update(message_from_alice)
               .verify(alice_public_key, signature)
               .should.equal(true);

        // -------------------------
        crypto.createVerify("RSA-SHA256")
              .update("Hello**HACK**World")
              .verify(alice_public_key, signature).should.equal(false);


        // The keys are asymmetrical, this means that Bob cannot sign
        // a message using alice public key.
        should(function() {
            var bob_sign = crypto.createSign("RSA-SHA256");
            bob_sign.update("HelloWorld");
            var signature = sign.sign(alice_public_key);
            //xx console.log("buffer length= ", signature.length);
            //xx console.log("buffer= ", signature.toString("hex"));
        }).throwError();



    });


    if (crypto_utils.publicEncrypt !== null) {

        it("should check that bob rsa key is 2048bit long (256 bytes)",function() {

            var key = crypto_utils.read_sshkey_as_pem('bob_id_rsa.pub');
            crypto_utils.rsa_length(key).should.equal(256);

        });

        it("should check that john rsa key is 1024bit long (128 bytes)",function() {

            var key = crypto_utils.read_sshkey_as_pem('john_id_rsa.pub');
            crypto_utils.rsa_length(key).should.equal(128);

        });
        it("RSA_PKCS1_OAEP_PADDING 1024 verifying that RSA publicEncrypt cannot encrypt buffer bigger than 215 bytes due to the effect of padding",function() {

            var john_public_key = read_sshkey_as_pem('john_id_rsa.pub'); // 1024 bit RSA
            debugLog('john_public_key',john_public_key);
            var encryptedBuffer;

            // since bob key is a 2048-RSA, encrypted buffer will be 2048-bits = 256-bytes long
            // Padding is 41 or 11 and added at the start of the buffer
            // so the max length of the input buffer sent to RSA_public_encrypt() is:
            //      128 - 42 = 215 with RSA_PKCS1_OAEP_PADDING

            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(1),john_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
            debugLog(" A encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(128);


            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(128-42),john_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
            debugLog(" B encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(128);

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(128-42+1),john_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
                debugLog(" C encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(128),john_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
                console.log(" D encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();
        });

        it("RSA_PKCS1_PADDING 2048 verifying that RSA publicEncrypt cannot encrypt buffer bigger than 215 bytes due to the effect of padding",function(){

            //
            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
            debugLog('bob_public_key',bob_public_key);
            var encryptedBuffer;

            // since bob key is a 2048-RSA, encrypted buffer will be 2048-bits = 256-bytes long
            // Padding is 41 or 11 and added at the start of the buffer
            // so the max length of the input buffer sent to RSA_public_encrypt() is:
            //      256 - 42 = 214 with RSA_PKCS1_OAEP_PADDING
            //      256 - 11 = 245 with RSA_PKCS1_PADDING

            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(1),bob_public_key,crypto_utils.RSA_PKCS1_PADDING);
            debugLog(" A encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);


            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(245),bob_public_key,crypto_utils.RSA_PKCS1_PADDING);
            debugLog(" B encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(246),bob_public_key,crypto_utils.RSA_PKCS1_PADDING);
                debugLog(" C encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(259),bob_public_key,crypto_utils.RSA_PKCS1_PADDING);
                console.log(" D encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();

        });

        it("RSA_PKCS1_OAEP_PADDING 2048 verifying that RSA publicEncrypt cannot encrypt buffer bigger than 215 bytes due to the effect of padding",function(){

            //
            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
            debugLog('bob_public_key',bob_public_key);
            var encryptedBuffer;

            // since bob key is a 2048-RSA, encrypted buffer will be 2048-bits = 256-bytes long
            // Padding is 41 or 11 and added at the start of the buffer
            // so the max length of the input buffer sent to RSA_public_encrypt() is:
            //      256 - 42 = 214 with RSA_PKCS1_OAEP_PADDING
            //      256 - 11 = 245 with RSA_PKCS1_PADDING

            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(1),bob_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
            debugLog(" A encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);

            encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(214),bob_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
            debugLog(" B encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(215),bob_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
                debugLog(" C encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();

            should(function(){
                encryptedBuffer = crypto_utils.publicEncrypt(new Buffer(259),bob_public_key,crypto_utils.RSA_PKCS1_OAEP_PADDING);
                console.log(" D encryptedBuffer length = ",encryptedBuffer.length);
                //xx encryptedBuffer.length.should.eql(128);
            }).throwError();

        });

        it("publicEncrypt  shall produce  different encrypted string if call many times with the same input",function() {

//xx            var bob_public_key = crypto_utils.readCertificate('test/fixtures/certs/server_cert_1024.pem'); // 2048bit long key
            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub'); // 2048bit long key
            var bob_private_key = read_private_rsa_key('bob_id_rsa');

            var initialBuffer = new Buffer(loremIpsum.substr(0,25));
            var encryptedBuffer1 = crypto_utils.publicEncrypt_long(initialBuffer,bob_public_key,256,11);
            var encryptedBuffer2 = crypto_utils.publicEncrypt_long(initialBuffer,bob_public_key,256,11);

            encryptedBuffer1.toString("hex").should.not.equal(encryptedBuffer2.toString("hex"));

            var decryptedBuffer1 = crypto_utils.privateDecrypt_long(encryptedBuffer1,bob_private_key,256);
            var decryptedBuffer2 = crypto_utils.privateDecrypt_long(encryptedBuffer2,bob_private_key,256);

            decryptedBuffer1.toString("hex").should.equal(decryptedBuffer2.toString("hex"));
        });

        it("publicEncrypt_long should encrypt a 256 bytes buffer and return a encrypted buffer of 512 bytes",function() {

            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub'); // 2048bit long key

            var initialBuffer = new Buffer(loremIpsum.substr(0,256));
            var encryptedBuffer = crypto_utils.publicEncrypt_long(initialBuffer,bob_public_key,256,11);
            encryptedBuffer.length.should.eql(256*2);

            var bob_private_key = read_private_rsa_key('bob_id_rsa');
            var decryptedBuffer = crypto_utils.privateDecrypt_long(encryptedBuffer,bob_private_key,256);
            decryptedBuffer.toString("ascii").should.eql(initialBuffer.toString("ascii"));
        });


        it("publicEncrypt_long should encrypt a 1024 bytes buffer and return a encrypted buffer of 1280 bytes",function() {

            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');

            var initialBuffer = new Buffer(loremIpsum.substr(0,1024));
            var encryptedBuffer = crypto_utils.publicEncrypt_long(initialBuffer,bob_public_key,256,11);
            encryptedBuffer.length.should.eql(256*5);

            var bob_private_key = read_private_rsa_key('bob_id_rsa');
            var decryptedBuffer = crypto_utils.privateDecrypt_long(encryptedBuffer,bob_private_key,256);
            decryptedBuffer.length.should.equal(initialBuffer.length);
            decryptedBuffer.toString("ascii").should.eql(initialBuffer.toString("ascii"));

        });

        it("Alice should be able to encrypt a message with bob's public key and Bob shall be able to decrypt it with his Private Key",function() {

            // see also : http://crypto.stackexchange.com/questions/5458/should-we-sign-then-encrypt-or-encrypt-then-sign


            // ------------------- this is Alice
            //
            // Alice want to send a message to Bob.
            // Alice want bob to be the only person that can read the message.
            // Alice will encrypt her message to bob using bob's public key.
            //
            // she will sign he message first with her private key

            var message = "My dear Bob, " + loremIpsum + "... Alice";
            debugLog("length of original  message = ", message.length);

            var alice_private_key = read_private_rsa_key('alice_id_rsa');
            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');

            var signature = crypto.createSign("RSA-SHA256").update(message).sign(alice_private_key);
            debugLog("signature = ", signature.toString("hex"));
            debugLog("signature length = ", signature.length);


            debugLog(bob_public_key);

            var encryptedMessage = crypto_utils.publicEncrypt_long(new Buffer(message),bob_public_key,256,42);

            debugLog("encrypted message=", encryptedMessage.toString("hex"));

            debugLog("length of encrypted message = ", encryptedMessage.length);

            // ------------------- this is Bob
            // Bob has received a encrypted message from Alice.

            // Bob must first decipher the message using its own private key

            var bob_private_key = read_private_rsa_key('bob_id_rsa');
            var alice_public_key = read_sshkey_as_pem('alice_id_rsa.pub');

            //xx encryptedMessage += "q";

            var decryptedMessage = crypto_utils.privateDecrypt_long(encryptedMessage,bob_private_key,256).toString();
            debugLog("decrypted message=", decryptedMessage.toString());

            // then Bob must also verify that the signature is matching
            crypto.createVerify("RSA-SHA256")
                .update(decryptedMessage)
                .verify(alice_public_key, signature).should.equal(true);

            // He wants to verify that the message is really from by Alice.
            // Alice has given Bob her public_key.
            // Bob uses Alice's public key to verify that the message is correct



        });
    }

    it("explore DiffieHellman encryption (generating keys)",function() {

        var crypto = require("crypto");


        var alice = crypto.getDiffieHellman('modp5');
        var bob = crypto.getDiffieHellman('modp5');

        alice.generateKeys();
        bob.generateKeys();

        var alice_secret = alice.computeSecret(bob.getPublicKey(), null, 'hex');
        var bob_secret = bob.computeSecret(alice.getPublicKey(), null, 'hex');

        /* alice_secret and bob_secret should be the same */
        alice_secret.should.eql(bob_secret);


    });



    // encrypt_buffer(buffer,'aes-256-cbc',key);
    it("should encrypt a message", function () {



        // http://stackoverflow.com/questions/8750780/encrypting-data-with-public-key-in-node-js
        // http://slproweb.com/products/Win32OpenSSL.html
        var public_key = fs.readFileSync(alice_public_key_filename);

        public_key = public_key.toString('ascii');


        // var pubkey = ursa.createPublicKey(public_k ey);

        var buf = new Buffer(16);
        buf.writeDoubleLE(3.14, 0);
        buf.writeDoubleLE(3.14, 8);

        var encryptedBuf = encrypt_buffer(buf, 'aes-256-cbc', public_key);

        var s = fs.createWriteStream("output2.bin", "ascii");
        s.write(encryptedBuf.toString("hex"));
        s.end();


    });





    it("exploring crypto api with symmetrical encryption/decryption", function () {

        var crypto = require("crypto")
            , key = 'salt_from_the_user_document'
            , buffer = new Buffer('This is a top , very top secret message !! ah ah' + loremIpsum);


        var encrypted_buff = encrypt_buffer(buffer, 'aes-256-cbc', key);
        var decrypted_buff = decrypt_buffer(encrypted_buff, 'aes-256-cbc', key);


        // xx console.log('encrypted  %d :', encrypted_buff.length,encrypted_buff.toString("hex"));
        // xx console.log('decrypted  %d :', decrypted_buff.length,decrypted_buff.toString("hex"));
        // xx console.log('decrypted  %d :', buffer.length,buffer.toString("hex"));
        buffer.toString("hex").should.equal(decrypted_buff.toString("hex"));
    })
});


describe("exploring symmetric signing",function() {

    it("should sign and verify",function() {

        var crypto = require("crypto"),
            text = 'I love cupcakes',
            key = crypto.randomBytes(32);

        var hash = crypto.createHmac('sha1', key).update(text).digest();

        assert(hash instanceof Buffer);
        //xx console.log(hash.toString("hex"), hash.length);

        hash.length.should.eql(20);
        // TO DO : to be completed.

    });

});



/// -------------------------------------------------------------

var ursa = null;
try {
    ursa = require("ursa");
}
catch(err) {
    ursa = null;
}

if (!ursa) {
    console.log(" WARNING : SKIPPING TEST WITH ursa".red);
}else {

    var fs = require("fs");
    // openssl genrsa -out certs/server/my-server.key.pem 2048
    // openssl rsa -in certs/server/my-server.key.pem -pubout -out certs/client/my-server.pub

    // See also:
    // https://github.com/coolaj86/nodejs-self-signed-certificate-example
    // https://github.com/coolaj86/node-ssl-root-cas/wiki/Painless-Self-Signed-Certificates-in-node.js
    // https://github.com/coolaj86/node-ssl-root-cas
    // https://github.com/coolaj86/bitcrypt


    describe("Testing AsymmetricSignatureAlgorithm",function() {

        var chunk = new Buffer(loremIpsum);


        //xx crypto.getHashes().forEach(function(a){ make_suite(a,128); });
        make_suite("RSA-SHA384",128);
        make_suite("RSA-SHA512",128);
        make_suite("RSA-SHA256",128);
        make_suite("RSA-SHA1",128);
        make_suite("RSA-MD4",128);
        make_suite("sha224WithRSAEncryption",128);
        make_suite("shaWithRSAEncryption",128);


        function make_suite(algorithm,length) {

            it("should sign with a private key and verify with the public key (ASCII) - " + algorithm,function(){

                var alice_private_key = fs.readFileSync(alice_private_key_filename).toString('ascii');
                var options1 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    privateKey: alice_private_key
                };
                var signature =  crypto_utils.makeMessageChunkSignature(chunk,options1);

                //xx console.log("signature =".yellow,"\n");
                //xx console.log(utils.hexDump(signature));

                //xx console.log("SIGNATURE = ".yellow.bold,new Buffer(signature).toString("base64"));
                signature.should.be.instanceOf(Buffer);
                signature.length.should.eql(options1.signatureLength);

                var alice_public_key = fs.readFileSync(alice_public_key_filename).toString('ascii');
                var options2 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    publicKey: alice_public_key
                };
                var signVerif = crypto_utils.verifyMessageChunkSignature(chunk,signature,options2);
                signVerif.should.eql(true);


            });

            it("should sign with a private key and verify with the certificate (ASCII) - " + algorithm,function(){

                var alice_private_key = fs.readFileSync(alice_private_key_filename).toString('ascii');
                var options1 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    privateKey: alice_private_key
                };
                var signature =  new Buffer(crypto_utils.makeMessageChunkSignature(chunk,options1),"binary"); // Buffer

                //xx console.log("signature =".yellow,"\n");
                //xx console.log(utils.hexDump(signature));

                signature.should.be.instanceOf(Buffer);
                signature.length.should.eql(options1.signatureLength);


                var alice_certificate = fs.readFileSync(alice_certificate_filename).toString('ascii');

                var options2 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    publicKey: alice_certificate
                };
                var signVerif = crypto_utils.verifyMessageChunkSignature(chunk,signature,options2);
                signVerif.should.eql(true);


            });

            it("should sign with a private key and verify with the certificate (DER) - " + algorithm,function(){

                var alice_private_key = crypto_utils.readKey(alice_private_key_filename);
                var options1 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    privateKey: crypto_utils.toPem(alice_private_key,"RSA PRIVATE KEY")
                };
                var signature =  new Buffer(crypto_utils.makeMessageChunkSignature(chunk,options1),"binary"); // Buffer

                //xx console.log("signature =".yellow,"\n");
                //xx console.log(utils.hexDump(signature));

                signature.should.be.instanceOf(Buffer);
                signature.length.should.eql(options1.signatureLength);


                var alice_certificate = crypto_utils.readKey(alice_certificate_filename);

                var options2 = {
                    algorithm : algorithm,
                    signatureLength: length,
                    publicKey: crypto_utils.toPem(alice_certificate,"CERTIFICATE")
                };
                var signVerif = crypto_utils.verifyMessageChunkSignature(chunk,signature,options2);
                signVerif.should.eql(true);


            });

        }
    });


    describe("Testing public key encryption with URSA", function () {


        var bob_public_key,bob_private_key;
        beforeEach(function(done){

            switch_to_test_certificate_store();
            bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
            bob_private_key = read_private_rsa_key('bob_id_rsa');
            done();
        });
        afterEach(function(done){restore_default_certificate_store();done();});

        it("should encrypt with a public_key and decrypt with the private key a fairly small message", function () {

            var crt = ursa.createPublicKey(bob_public_key);
            var key = ursa.createPrivateKey(bob_private_key);

            var messageToEncrypt = new Buffer("Everything is going to be 200 OK ");

            //xx console.log('Encrypt with Public'.yellow);
            var encryptedMessage = crt.encrypt(messageToEncrypt);
            //xx console.log('encrypted'.yellow, encryptedMessage.toString("base64"), '\n');

            //xx console.log('Decrypt with Private'.cyan.bold);
            var decryptedMessage = key.decrypt(encryptedMessage);
            assert(decryptedMessage instanceof Buffer);
            //xx console.log('decrypted'.yellow, decryptedMessage.toString("ascii"), '\n');

            decryptedMessage.should.eql(messageToEncrypt);
        });

        it("REVERSE : should encrypt with a private_key and decrypt with the public key a small message", function () {

            var crt = ursa.createPrivateKey(bob_private_key);
            var key = ursa.createPublicKey(bob_public_key);

            var messageToEncrypt = new Buffer("Everything is going to be 200 OK ");

            //xx console.log('Encrypt with Private (called public)'.yellow);
            var encryptedMessage = key.encrypt(messageToEncrypt);
            //xx console.log('encrypted'.yellow, encryptedMessage.toString("hex"), '\n');

            //xx console.log('Decrypt with Public (called private)');
            var decryptedMessage = crt.decrypt(encryptedMessage);
            //xx console.log('decrypted'.yellow, decryptedMessage.toString("ascii"), '\n');

            decryptedMessage.should.eql(messageToEncrypt);
        });
    });

    describe("Testing OPCUA key encryption/decryption with URSA", function () {

        var server_public_key,server_private_key;
        beforeEach(function(done){

            switch_to_test_certificate_store();

            // let use our default 1024 RSA key pair
            server_public_key = crypto_utils.read_public_rsa_key('server_public_key_1024.pub');
            server_private_key = crypto_utils.read_private_rsa_key('server_key_1024.pem');
            done();
        });
        afterEach(function(done){
            restore_default_certificate_store();
            done();
        });

        it("should encrypt a message with the  server public key and decrypt it (1024bits RSA)",function() {

            var messageToEncrypt = new Buffer(require("test/helpers/lorem_ipsum").loremIpsum);

            var encryptedBuf = crypto_utils.publicEncrypt_long(messageToEncrypt,server_public_key,128,11);

            var decryptedBuf  = crypto_utils.privateDecrypt_long(encryptedBuf,server_private_key,128);

            decryptedBuf.toString("ascii").should.eql(messageToEncrypt.toString("ascii"));
            //Xx console.log("decryptedBuf",decryptedBuf.toString("ascii"));
        });
    });

}

var hexDump = require("lib/misc/utils").hexDump;

describe("extractPublicKeyFromCertificate",function() {

    it("should extract a public key from a certificate",function(done){

        var  certificate = fs.readFileSync('certificates/client_cert_1024.pem').toString('ascii');
        //xx console.log(" certificate");

        var  certificate2 = crypto_utils.readCertificate('certificates/client_cert_1024.pem');
        //xx console.log(hexDump(certificate2));

        var  publickey2 = crypto_utils.readKey('certificates/client_public_key_1024.pub');
        //xx console.log(hexDump(publickey2));

        crypto_utils.extractPublicKeyFromCertificate(certificate2,function(err,publicKey){

            var raw_public_key = crypto_utils.readPEM(publicKey);
            //xx console.log(hexDump(raw_public_key));

            raw_public_key.toString("base64").should.eql(publickey2.toString("base64"));
            done(err);
        });

    });
});

