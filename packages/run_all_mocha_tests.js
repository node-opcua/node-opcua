"use strict";

require("source-map-support").install();
require("ts-node").register();

Error.stackTraceLimit = Infinity;

let Mocha = require("mocha"),
  fs = require("fs"),
  path = require("path");

require("mocha-clean");

let filterOpts = process.argv[process.argv.length - 1];

if (filterOpts.match(/run_all_mocha/)) {
    filterOpts = "";
}
console.log("filterOpts", filterOpts);
// Instantiate a Mocha instance.
let mocha = new Mocha({
    bail: false,
    grep: filterOpts,
    fullTrace: true,
    slow: 1000,
    reporter: process.env.REPORTER || "spec" //"nyan", //"tap"
});


let test_files = [];

function collect_files(test_folder) {

    fs.readdirSync(test_folder).forEach(function (file) {
        let f = path.join(test_folder, file);
        if (fs.lstatSync(f).isDirectory()) {
            collect_files(f);
        } else {
            if (file.match(/^test_.*.js/)) {
                test_files.push(f);
            } else {
                //xx console.log("skipping file ",f);
            }
        }
    });
}

fs.readdirSync(__dirname).forEach(function (file) {

    let test_folder = path.join(__dirname, file, "test");
    if (fs.existsSync(test_folder)) {
        collect_files(test_folder);
    }
});

test_files = test_files.sort();
// Add each .js file to the mocha instance
test_files.filter(function (file) {
    // Only keep the .js files
    const extension = file.substr(-3);
    return extension === ".js" || extension === ".ts";
}).forEach(function (file) {

    function test_no_leak() {

        let t = fs.readFileSync(file, "ascii");
        if (t.match("OPCUAClient")) {
            if (!t.match("Leak")) {
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
    process.exit(failures);  // exit with non-zero status if there were failures
});

