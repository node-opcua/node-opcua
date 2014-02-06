
var crypto = require("crypto");
var fs= require("fs");
var should = require("should");

var hexy = require("hexy");

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


    function encrypt_buffer(buffer,algorithm,key) {
        var crypto = require('crypto');
        var cipher = crypto.createCipher(algorithm, key);
        var encrypted_chunks= [];
        encrypted_chunks.push(cipher.update(buffer));
        encrypted_chunks.push(cipher.final());

        return Buffer.concat(encrypted_chunks);
    };

    function decrypt_buffer(buffer,algorithm,key) {
        var crypto = require('crypto');
        var decipher = crypto.createDecipher('aes-256-cbc', key);
        var decrypted_chunks= [];
        decrypted_chunks.push(decipher.update(buffer));
        decrypted_chunks.push(decipher.final());
        return Buffer.concat(decrypted_chunks);
    }
    // encrypt_buffer(buffer,'aes-256-cbc',key);
    it("should encrypt a message",function() {



        // http://stackoverflow.com/questions/8750780/encrypting-data-with-public-key-in-node-js
        // http://slproweb.com/products/Win32OpenSSL.html
        var public_key = fs.readFileSync('certificates/public_key.pub');
        public_key = public_key.toString('ascii');


        // var pubkey = ursa.createPublicKey(public_k ey);

        var buf = new Buffer(16);
        buf.writeDoubleLE(3.14,0);
        buf.writeDoubleLE(3.14,8);

        var encryptedBuf = encrypt_buffer(buf,'aes-256-cbc',public_key);

        var s = fs.createWriteStream("output2.bin","ascii");
        s.write(encryptedBuf.toString("hex"));
        s.end();




    });

    var loremIpsum= "Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam " +
                    "nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat "+
                    "volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation "+
                    "ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat."+
                    "Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse "+
                    "molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros "+
                    "et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit "+
                    "augue duis dolore te feugait nulla facilisi. Nam liber tempor cum soluta nobis "+
                    "eleifend option congue nihil imperdiet doming id quod mazim placerat facer possim "+
                    "assum. Typi non habent claritatem insitam; est usus legentis in iis qui facit eorum "+
                    "claritatem. Investigationes demonstraverunt lectores legere me lius quod ii legunt"+
                    "saepius. Claritas est etiam processus dynamicus, qui sequitur mutationem consuetudium "+
                    "lectorum. Mirum est notare quam littera gothica, quam nunc putamus parum claram, "+
                    "anteposuerit litterarum formas humanitatis per seacula quarta decima et quinta "+
                    "decima. Eodem modo typi, qui nunc nobis videntur parum clari, fiant sollemnes in futurum.";


    it("exploring crypto api",function(){

        var crypto = require('crypto')
            , key = 'salt_from_the_user_document'
            , buffer = new Buffer('This is a top , very top secret message !! ah ah' + loremIpsum)



        var encrypted_buff =encrypt_buffer(buffer,'aes-256-cbc',key);
        var decrypted_buff = decrypt_buffer(encrypted_buff,'aes-256-cbc',key);


        // xx console.log('encrypted  %d :', encrypted_buff.length,encrypted_buff.toString("hex"));
        // xx console.log('decrypted  %d :', decrypted_buff.length,decrypted_buff.toString("hex"));
        // xx console.log('decrypted  %d :', buffer.length,buffer.toString("hex"));
        buffer.toString("hex").should.equal(decrypted_buff.toString("hex"));
    })
});
