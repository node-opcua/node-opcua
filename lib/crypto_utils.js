var fs = require("fs");




function read_certificate(filename) {

    var private_key_pem = fs.readFileSync(filename);
    var private_key = private_key_pem.toString('ascii');
    var a = private_key.split("\n");
    var base64Str="";
    for(var i=1;i< a.length-2;i+=1) {
        base64Str = base64Str+a[i];
    }
    return new Buffer(base64Str,"base64");
}
exports.read_certificate = read_certificate;
