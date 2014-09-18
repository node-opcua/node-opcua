var crypto = require("crypto");
var fs = require("fs");
var should = require("should");
var colors = require("colors");
var assert = require("assert");

var loremIpsum = require("./helpers/lorem_ipsum").loremIpsum;

// generate a self-signed key
// openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout key.pem -out cert.pem
// generate public key from private.key
// openssl rsa -in key.pem -pubout > public_key.pub will extract the public key and print that out.
//
// converting der to pem files:
// openssl x509 -inform DER -outform PEM -text -in der-certificate-file -out pem-certificate-file
//
// converting pem to der files:
// openssl rsa -inform DER -outform PEM -in der-rsa-key-file -out pem-rsa-key-file
//
// If you have .pfx certificates you can convert them to .pem using openssl:
//openssl pkcs12 -in  cert.pfx -out cert.pem

// refs:
//  http://users.dcc.uchile.cl/~pcamacho/tutorial/crypto/openssl/openssl_intro.html 
//
// Create a set of  key pair
//   -  ssh-keygen -t rsa -C "Bob" -f bob_id_rsa -q -N ""
//   -  ssh-keygen -t rsa -b 2048 -C "Alice" -f alice_id_rsa -q -N ""
//

// refs: https://github.com/dominictarr/ssh-key-to-pem
//
var doDebug = false;
doDebug = true;
function debugLog() {
    if (doDebug) {
        console.log.apply(console, arguments);
    }
}


// symmetric encryption and decryption
function encrypt_buffer(buffer, algorithm, key) {
    var crypto = require('crypto');
    var cipher = crypto.createCipher(algorithm, key);
    var encrypted_chunks = [];
    encrypted_chunks.push(cipher.update(buffer));
    encrypted_chunks.push(cipher.final());

    return Buffer.concat(encrypted_chunks);
}

function decrypt_buffer(buffer, algorithm, key) {
    var crypto = require('crypto');
    var decipher = crypto.createDecipher(algorithm, key);
    var decrypted_chunks = [];
    decrypted_chunks.push(decipher.update(buffer));
    decrypted_chunks.push(decipher.final());
    return Buffer.concat(decrypted_chunks);
}



function display_public_key_Encryption_missing_message() {
    console.warn("\n Warning : your version of node doesn't provide crypto.publicEncrypt yet ".yellow,process.version);
    console.warn("           This should be sorted out in node > 0.12".cyan);
    console.warn("           require('ursa') doesn't seem to be installed either or is not compatible".yellow);
}

// Basically when you encrypt something using an RSA key (whether public or private), the encrypted value must
// be smaller than the key (due to the maths used to do the actual encryption). So if you have a 1024-bit key,
// in theory you could encrypt any 1023-bit value (or a 1024-bit value smaller than the key) with that key.
// However, the PKCS#1 standard, which OpenSSL uses, specifies a padding scheme (so you can encrypt smaller
// quantities without losing security), and that padding scheme takes a minimum of 11 bytes (it will be longer
// if the value you're encrypting is smaller). So the highest number of bits you can encrypt with a 1024-bit
// key is 936 bits because of this (unless you disable the padding by adding the OPENSSL_NO_PADDING flag,
// in which case you can go up to 1023-1024 bits). With a 2048-bit key it's 1960 bits instead.

var ursa = null;
try {
ursa = require("ursa");
}
catch(err) {
    ursa = null;
}

// publicEncrypt and  privateDecrypt only work with
// small buffer that depends of the key size.
function publicEncrypt_native(buffer,public_key) {
    assert(buffer instanceof Buffer,"Expecting a buffer");
    return crypto.publicEncrypt(public_key,buffer);
}
function publicEncrypt_ursa(buffer,public_key) {
    assert(ursa);
    var crt = ursa.createPublicKey(public_key);
    buffer = crt.encrypt(buffer);
    return buffer;
}

function privateDecrypt_native(buffer,private_key) {
    assert(buffer instanceof Buffer,"Expecting a buffer");
    return crypto.privateDecrypt(private_key,buffer);
}

function privateDecrypt_ursa(buffer,private_key) {
    assert(ursa);
    var key = ursa.createPrivateKey(private_key);
    buffer = key.decrypt(buffer);
    return buffer;
}

function publicEncrypt_long(buffer,key,block_size,padding) {

    var chunk_size = block_size - padding;
    var nbBlocks = Math.ceil(buffer.length / (chunk_size));

    var outputBuffer = new Buffer(nbBlocks * block_size);
    for (var i = 0; i < nbBlocks; i++) {
        var currentBlock  = buffer.slice(chunk_size*i,chunk_size*(i+1));
        var encrypted_chunk = publicEncrypt(currentBlock,key);
        encrypted_chunk.copy(outputBuffer,i*block_size);
    }
    return outputBuffer;
}

function privateDecrypt_long(buffer,key,block_size,padding) {

    var chunk_size = block_size - padding;
    var nbBlocks = Math.ceil(buffer.length / (block_size));

    var outputBuffer = new Buffer(nbBlocks * chunk_size);

    var total_length = 0;
    for (var i = 0; i < nbBlocks; i++) {
        var currentBlock  = buffer.slice(block_size*i,block_size*(i+1));
        var decrypted_buf = privateDecrypt(currentBlock,key);
        total_length+= decrypted_buf.length;
        decrypted_buf.copy(outputBuffer,i*chunk_size);
    }
    return outputBuffer.slice(0,total_length);

}
var publicEncrypt = null;
var privateDecrypt = null;
if (!ursa && !crypto.hasOwnProperty("publicEncrypt") ) {
    display_public_key_Encryption_missing_message();
} else {
    publicEncrypt =  crypto.hasOwnProperty("publicEncrypt") ?   publicEncrypt_native : publicEncrypt_ursa;
    privateDecrypt=  crypto.hasOwnProperty("publicEncrypt") ?   privateDecrypt_native : privateDecrypt_ursa;
}


var sshKeyToPEM = require('ssh-key-to-pem');
var  __certificate_store = __dirname + "/helpers/";
function read_sshkey_as_pem(filename) {
    var key = fs.readFileSync( __certificate_store + filename,"ascii");
    key = sshKeyToPEM(key);
    return key;
}
function read_private_rsa_key(filename) {
    var key = fs.readFileSync( __certificate_store + filename,"ascii");
    return key;
}


//  ursa only work with node version <= 0.10
//  however crypto.publicEncryp only appear in node > 0.11.14
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


    it("should be possible to sign a message and verify the signature of a message", function () {

        // ------------------- this is Alice
        //
        // alice want to send a message to Bob
        var message = "HelloWorld";

        // alice will sign her message to bob with her private key.
        var alice_private_key_pem = fs.readFileSync('certificates/key.pem');
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

        var alice_public_key = fs.readFileSync('certificates/public_key.pub','ascii');

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
            console.log("buffer length= ", signature.length);
            console.log("buffer= ", signature.toString("hex"));
        }).throwError();



    });


    if (publicEncrypt !== null) {

        it("verifying that RSA publicEncrypt cannot encrypt buffer bigger than 215 bytes due to the effect of padding",function(){

            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
            var encryptedBuffer;

            // Padding is 41 and added at the start of the buffer
            // so the max length of the input buffer sent to RSA_public_encrypt() is 256 - 41 = 215

            encryptedBuffer = publicEncrypt(new Buffer(1),bob_public_key);
            console.log(" encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);


            encryptedBuffer = publicEncrypt(new Buffer(214),bob_public_key);
            console.log(" encryptedBuffer length = ",encryptedBuffer.length);
            encryptedBuffer.length.should.eql(256);

            should(function(){
                encryptedBuffer = publicEncrypt(new Buffer(215),bob_public_key);
                console.log(" encryptedBuffer length = ",encryptedBuffer.length);
                encryptedBuffer.length.should.eql(256);
            }).throwError();

            should(function(){
                encryptedBuffer = publicEncrypt(new Buffer(215),bob_public_key);
                console.log(" encryptedBuffer length = ",encryptedBuffer.length);
                encryptedBuffer.length.should.eql(256);
            }).throwError();

        });

        it("publicEncrypt_long should encrypt a 256 bytes buffer and return a encrypted buffer of 512 bytes",function() {

            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');

            var initialBuffer = new Buffer(loremIpsum.substr(0,256));
            var encryptedBuffer = publicEncrypt_long(initialBuffer,bob_public_key,256,42);
            encryptedBuffer.length.should.eql(256*2);

            var bob_private_key = read_private_rsa_key('bob_id_rsa');

            var decryptedBuffer = privateDecrypt_long(encryptedBuffer,bob_private_key,256,42);

            decryptedBuffer.toString("ascii").should.eql(initialBuffer.toString("ascii"));
        });


        it("publicEncrypt_long should encrypt a 1024 bytes buffer and return a encrypted buffer of 512 bytes",function() {

            var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
            var encryptedBuffer = publicEncrypt_long(new Buffer(1024),bob_public_key,256,42);
            encryptedBuffer.length.should.eql(256*5);

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

            var encryptedMessage = publicEncrypt_long(new Buffer(message),bob_public_key,256,42);

            debugLog("encrypted message=", encryptedMessage.toString("hex"));

            debugLog("length of encrypted message = ", encryptedMessage.length);

            // ------------------- this is Bob
            // Bob has received a encrypted message from Alice.

            // Bob must first decipher the message using its own private key

            var bob_private_key = read_private_rsa_key('bob_id_rsa');
            var alice_public_key = read_sshkey_as_pem('alice_id_rsa.pub');

            //xx encryptedMessage += "q";

            var decryptedMessage = privateDecrypt_long(encryptedMessage,bob_private_key,256,42).toString();
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

        var crypto = require('crypto');


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
        var public_key = fs.readFileSync('certificates/public_key.pub');
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

        var crypto = require('crypto')
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

        var crypto = require('crypto'),
            text = 'I love cupcakes',
            key = crypto.randomBytes(32),
            hash;

        hash = new Buffer(crypto.createHmac('sha1', key).update(text).digest('binary'),'binary');

        console.log(hash.toString("hex"), hash.length);

        hash.length.should.eql(20);
    });

});



/// -------------------------------------------------------------


if (ursa) {

    var fs = require('fs');
    // openssl genrsa -out certs/server/my-server.key.pem 2048
    // openssl rsa -in certs/server/my-server.key.pem -pubout -out certs/client/my-server.pub

    // See also:
    // https://github.com/coolaj86/nodejs-self-signed-certificate-example
    // https://github.com/coolaj86/node-ssl-root-cas/wiki/Painless-Self-Signed-Certificates-in-node.js
    // https://github.com/coolaj86/node-ssl-root-cas
    // https://github.com/coolaj86/bitcrypt

    var bob_public_key = read_sshkey_as_pem('bob_id_rsa.pub');
    var bob_private_key = read_private_rsa_key('bob_id_rsa');


    describe("Testing public key encryption with URSA", function () {

        it("should encrypt with a public_key and decrypt with the private key a fairly small message", function () {

            var crt = ursa.createPublicKey(bob_public_key);
            var key = ursa.createPrivateKey(bob_private_key);

            var messageToEncrypt = new Buffer("Everything is going to be 200 OK ");

            console.log('Encrypt with Public'.yellow);
            var encryptedMessage = crt.encrypt(messageToEncrypt);
            console.log('encrypted'.yellow, encryptedMessage.toString("base64"), '\n');

            console.log('Decrypt with Private'.cyan.bold);
            var decryptedMessage = key.decrypt(encryptedMessage);
            assert(decryptedMessage instanceof Buffer);
            console.log('decrypted'.yellow, decryptedMessage.toString("ascii"), '\n');

            decryptedMessage.should.eql(messageToEncrypt);
        });

        it("REVERSE : should encrypt with a private_key and decrypt with the public key a small message", function () {


            var crt = ursa.createPrivateKey(bob_private_key);
            var key = ursa.createPublicKey(bob_public_key);

            var messageToEncrypt = new Buffer("Everything is going to be 200 OK ");

            console.log('Encrypt with Private (called public)'.yellow);
            var encryptedMessage = key.encrypt(messageToEncrypt);
            console.log('encrypted'.yellow, encryptedMessage.toString("hex"), '\n');

            console.log('Decrypt with Public (called private)');
            var decryptedMessage = crt.decrypt(encryptedMessage);
            console.log('decrypted'.yellow, decryptedMessage.toString("ascii"), '\n');

            decryptedMessage.should.eql(messageToEncrypt);
        });
    });
}
