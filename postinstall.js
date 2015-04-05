var child_process = require("child_process");


function exec(cmd,callback) {

    console.log("Executing " ,cmd);
    var child = child_process.exec(cmd,function(err) {
        console.log("done ...");
        callback(err);
    });

    child.stdout.pipe(process.stdout);

    child.on('close', function(code) {
        console.log('closing code: ' + code);
    });
}

exec("node bin/generate_opcua_classes.js --clear ",function() {
    exec( "node bin/crypto_create_CA.js ",function() {
        console.log("done");
    });
});
