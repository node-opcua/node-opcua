"use strcit";
require("should");
const fs = require("fs");

const redirectToFile = require("..").redirectToFile;
const getTempFilename = require("../").getTempFilename;


describe("testing redirectToFile", function () {

    it("should redirectToFile with a sync function", function () {

        redirectToFile("redirectToFile_without_callback.log", function () {
            console.log("Hello World");
        });
    });

    it("should redirectToFile with a  callback", function (done) {

        redirectToFile("redirectToFile_with_a_callback.log", function () {
            console.log("Hello World");
        }, done);
    });

    it("should redirectToFile with a sync function", function () {

        redirectToFile("redirectToFile_sync.log", function () {

            console.log("Hello World");

        }, function () {

            const filename = getTempFilename("redirectToFile_sync.log");
            const txt = fs.readFileSync(filename, "ascii");
            txt.should.eql("Hello World\n");

        });

    });

    function async_function(callback) {

        setImmediate(function () {
            console.log("Hello World !!!");
            callback();
        });
    }

    it("should redirectToFile with a asynchronous function", function (done) {


        redirectToFile("redirectToFile_async.log", function (inner_done) {
            async_function(inner_done);
        }, function () {

            const filename = getTempFilename("redirectToFile_async.log");
            const txt = fs.readFileSync(filename, "ascii");
            txt.should.eql("Hello World !!!\n");
            done();
        });
    });
});