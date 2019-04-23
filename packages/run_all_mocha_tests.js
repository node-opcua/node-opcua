#!node
"use strict";

const Mocha = require("mocha");
const fs = require("fs");
const path = require("path");

require("source-map-support").install();
require("ts-node").register({
    transpileOnly: true
});

Error.stackTraceLimit = Infinity;

require("mocha-clean");

let filterOpts = process.argv[process.argv.length - 1];

if (filterOpts.match(/run_all_mocha/)) {
    filterOpts = "";
}
if (filterOpts) {
    console.log("test filter = ", filterOpts);
}
// Instantiate a Mocha instance.
let mocha = new Mocha({
    bail: true,
    fullTrace: true,
    grep: filterOpts,
    reporter: process.env.REPORTER || "spec", //"nyan", //"tap"
    slow: 6000,
});


let testFiles = [];

function collect_files(testFolder) {

    for (const file of fs.readdirSync(testFolder)) {

        let f = path.join(testFolder, file);
        if (fs.lstatSync(f).isDirectory()) {
            collect_files(f);
        } else {

            if (file.match(/^test_.*\.ts/) && !file.match(/^test_.*\.d\.ts/) ) {

                testFiles.push(f);
            } else if (file.match(/^test_.*\.js/)) {
                // make sure that there is not a TS file along side
                if (fs.existsSync(file.replace(".js", ".ts"))) {
                    console.log("warning => transpiled js file ignored : ", file);
                } else {
                    testFiles.push(f);
                }
            } else {
                //xx console.log("skipping file ",f);
            }
        }
    }
}

for (const file of fs.readdirSync(__dirname)) {

    const testFolder = path.join(__dirname, file, "test");
    if (fs.existsSync(testFolder)) {
        collect_files(testFolder);
    }
}

testFiles = testFiles.sort();

// -------------------------------------------------
// portion
if (process.env.TESTPAGE) {

    console.log("nb files with tests : ", testFiles.length);

    const pageSize = 10;
    const testPage = parseInt(process.env.TESTPAGE);
    if (testPage== -1) {

        // display test page
        let i =0;
        while( testFiles) {

            console.log("\n --------------------------------- Page ",i);

            const a = testFiles.slice(i*pageSize, (i+1)* pageSize);
            if (a.length === 0){
                return;
            }
            for (const f of a) {
                console.log( "        " + f);
            }

            i++
        }

        exit(0);
    }
    testFiles = testFiles.slice(testPage*pageSize, (testPage+1)*pageSize );

    console.log(" Testing with test page : "+ testPage);
    console.log(testFiles[0]);
    console.log(testFiles[testFiles.length -1 ]);
}

const suite = mocha.suite;
suite.on('pre-require', ( global, file, self) => {
    //console.log("pre-require", file);
});
suite.on('require', (script, file, self) => {

});
suite.on('post-require', (global, file, self) => {
  //  console.log("post   -require", file);

});


// Add each .js file to the mocha instance
testFiles.filter((file) => {
    // Only keep the .js files
    const extension = file.substr(-3);
    return extension === ".js" || extension === ".ts";
}).forEach((file) => {

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
mocha.run((failures) => {
    process.exit(failures);  // exit with non-zero status if there were failures
});

