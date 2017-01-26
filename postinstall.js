const child_process = require("child_process");


let the_code = 61;
function exec(cmd,callback) {

    console.log("Executing " ,cmd);
    const child = child_process.exec(cmd,function(err) {});
    child.stdout.pipe(process.stdout);
    child.on('close', function(code) {
        the_code = code;
        console.log("done ... (" + the_code + ")");
        callback(code);
    });
}
const node = "babel-node ";

exec( node + " bin/generate_opcua_classes.js --clear ",function(result) {
    if(result) {
        console.log(" Generate OPC CLASSES has failed with error: ",result)
    }
    exec( node + " bin/crypto_create_CA.js demo",function(result) {

        if(result) {
            console.log(" Certificate generation has failed with error: ",result)
        } else {
            console.log('demo certificates generated !');
        }
    });
});
