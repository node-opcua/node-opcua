
var crypto = require("crypto");
var fs= require("fs");
var should = require("should");

// generate a self-signed key
// openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout key.pem -out cert.pem
// generate public key from private.key
// openssl rsa -in key.pem -pubout > public_key.pub will extract the public key and print that out.

var doDebug = false;
// doDebug = true;
function debugLog() {
    if (doDebug) {
        console.log.apply(console,arguments);
    }
}


function BufferStream(size)
{

}


describe("testing and exploring the NodeJS crypto api",function(){

    it("should know how to sign and verify a message",function(){

        // ------------------- this is Alice
        //
        // alice want to send a message to Bob
        //
        // alice want to sign a message with her private key
        // to make sure that the message received by Bob hasn't been tampered
        // on its way.
        //
        var private_key_pem = fs.readFileSync('certificates/key.pem');
        var private_key = private_key_pem.toString('ascii');
        debugLog(private_key);


        var sign = crypto.createSign("RSA-SHA256");
        sign.update("HelloWorld");

        var signature = sign.sign(private_key);
        debugLog("buffer length= ", signature.length);
        debugLog("buffer= ", signature.toString("hex"));

        // ------------------- this is Bob
        // Bob has received a message from Alice,
        // He want to verify that the message is really from by Alice.
        // Alice has given Bob her public_key.
        // Bob uses Alice's public key to verify that the
        // message is correct
        //
        var public_key = fs.readFileSync('certificates/public_key.pub');
        public_key = public_key.toString('ascii');

        var verify = crypto.createVerify("RSA-SHA256");
        verify.update("HelloWorld");
        verify.verify(public_key,signature).should.equal(true);

        // -------------------------
        verify = crypto.createVerify("RSA-SHA256");
        verify.update("Hello**HACK**World");
        verify.verify(public_key,signature).should.equal(false);

    });

    it("should encrypt a message",function() {

        var ursa = require('ursa');


        var rsa = require('rsa-stream');

        // http://stackoverflow.com/questions/8750780/encrypting-data-with-public-key-in-node-js
        // http://slproweb.com/products/Win32OpenSSL.html
        var public_key = fs.readFileSync('certificates/public_key.pub');
        public_key = public_key.toString('ascii');


        // var pubkey = ursa.createPublicKey(public_key);

        var buf = new Buffer(1024);
        buf.writeDoubleLE(3.14,0);
        buf.writeDoubleLE(3.14,4);

        var enc = rsa.encrypt(public_key);

        var through = require("through2");


        enc.pipe(through(function(chunk,enc,next) {
            this.push(chunk.toString("hex"));
            next();
        })).pipe(fs.createWriteStream("output2.bin","hex"));
        enc.write(buf);
        enc.end();


        // console.log(enc.read().toString("hex"));
        // var encoded = pubkey.encrypt(buf);

        // debugLog(encoded.toString("hex"));

        buf.write("HelloWorld",0);



    });

});
