
var crypto = require("crypto");
var fs= require("fs");
var should = require("should");

// generate a self-signed key
// openssl req -x509 -days 365 -nodes -newkey rsa:1024 -keyout key.pem -out cert.pem





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
        //xx console.log(private_key);

        var sign = crypto.createSign("RSA-SHA256");
        sign.update("HelloWorld");

        var signature = sign.sign(private_key);
        //xx console.log("buffer length= ", signature.length);
        //xx console.log("buffer= ", signature.toString("base64"));

        // ------------------- this is Bob
        // Bob has received a message from Alice,
        // He want to verify that the message is really from by Alice.
        // Alice has given Bob her public_key.
        // Bob uses Alice's public key to verify that the
        // message is correct
        //
        var public_key_pem = fs.readFileSync('certificates/cert.pem');
        var public_key = public_key_pem.toString('ascii');

        var verify = crypto.createVerify("RSA-SHA256");
        verify.update("HelloWorld");
        verify.verify(public_key,signature).should.equal(true);

        // -------------------------
        verify = crypto.createVerify("RSA-SHA256");
        verify.update("Hello**HACK**World");
        verify.verify(public_key,signature).should.equal(false);

    });

    it("should encrypt a message",function() {

    });

});
