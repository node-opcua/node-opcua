"use strcit";
require("should");
var fs = require("fs");

var redirectToFile = require("..").redirectToFile;
var getTempFilename = require("../").getTempFilename;


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

            var filename = getTempFilename("redirectToFile_sync.log");
            var txt = fs.readFileSync(filename, "ascii");
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

            var filename = getTempFilename("redirectToFile_async.log");
            var txt = fs.readFileSync(filename, "ascii");
            txt.should.eql("Hello World !!!\n");
            done();
        });
    });
});