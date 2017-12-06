"use strict";
Error.stackTraceLimit = Infinity;

var Mocha = require("mocha"),
  fs = require("fs"),
  path = require("path");

// Instantiate a Mocha instance.
var mocha = new Mocha({bail: true, fullTrace: true});


var test_files = [];

function collect_files(test_folder) {

    fs.readdirSync(test_folder).forEach(function (file) {
        var f = path.join(test_folder, file);
        if (fs.lstatSync(f).isDirectory()) {
            collect_files(f);
        } else {
            if (file.match(/^test_.*/)) {
                //xx if (!file.match("test_e2e_connection_reconnection.js")) {
                //xx     return;
                //xx }
                test_files.push(f);
            } else {
                //xx console.log("skipping file ",f);
            }
        }
    });
}

fs.readdirSync(__dirname).forEach(function (file) {

    var test_folder = path.join(__dirname, file, "test");
    if (fs.existsSync(test_folder)) {
        collect_files(test_folder);
    }
});

test_files = test_files.sort();
// Add each .js file to the mocha instance
test_files.filter(function (file) {

    // Only keep the .js files
    return file.substr(-3) === ".js";

}).forEach(function (file) {

    function test_no_leak() {

        var t = fs.readFileSync(file,"ascii");
        if (t.match("OPCUAClient")) {
            if (!t.match("Leak")){
                console.log(" OPCUAClient without leak !!!", file);
            }
        }
    }
    test_no_leak();

    mocha.addFile(file);
});

mocha.timeout(200000);
mocha.bail(true);

// Run the tests.
mocha.run(function (failures) {

//xx    process.on("exit", function () {
    process.exit(failures);  // exit with non-zero status if there were failures
//xx    });
});

