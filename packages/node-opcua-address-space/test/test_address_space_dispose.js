"use strict";
var path = require("path");
var should = require("should");
var fs = require("fs");
var AddressSpace = require("..").AddressSpace;
var generate_address_space = require("..").generate_address_space;

var async = require("async");


function dumpMemoryUse() {
    if (process.memoryUsage) {
        var m = process.memoryUsage()
        var h = require("humanize");
        console.log(" memoryUsage = ",
            " rss =", h.filesize(m.rss),
            " heapTotal =",h.filesize(m.heapTotal),
            " heapUsed =",h.filesize(m.heapUsed)
        );
    }
}
function callGarbageCollector(){
    if (global.gc) {
        global.gc();
    } else {
        console.log("Garbage collection unavailable.  Pass --expose-gc "
            + "when launching node to enable forced garbage collection.");
    }
}


describe("Testing AddressSpace memory Leaks",function(){


    var xml_file = path.join(__dirname,"../test_helpers/test_fixtures/mini.Node.Set2.xml");
    fs.existsSync(xml_file).should.be.eql(true,"cannot find mini node set");

    it("It should dispose an address_space",function(done) {

        var addressSpace = new AddressSpace();

        generate_address_space(addressSpace, xml_file, function (err) {
            addressSpace.dispose();
            addressSpace = null;
            done(err);
        });
    });

    this.timeout(200000);
    it("It should repeatedly load an address_space => no Leak",function(done) {

        function f(callback) {

            var addressSpace = new AddressSpace();
            generate_address_space(addressSpace, xml_file, function (err) {
                addressSpace.dispose();
                addressSpace = null;
                callback(err);
            });
        }

        var memBefore;
        function snapshot(callback) {
            callGarbageCollector();
            dumpMemoryUse();
            memBefore = process.memoryUsage();
            callback();
        }
        function compare(callback) {
            callGarbageCollector();
            dumpMemoryUse();
            var memAfter = process.memoryUsage();
            memAfter.heapUsed.should.be.lessThan(Math.ceil(memBefore.heapUsed*3.0));
            callback();
        }
        async.series([
            snapshot,
            f,f,f,f,f,f,f,f,f,f,f,
            f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,
/*
            f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,
            f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,
            f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,f,
*/
            compare ],done);
    });
});
