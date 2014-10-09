var utils  =require("../../lib/misc/utils");
var should = require("should");


describe("testing utility functions",function(){


    var old_console_log;
    beforeEach(function() {
        old_console_log = console.log;
        console.log = function() {};
    });
    afterEach(function(){
        console.log = old_console_log;
    });
    it("replaceBufferWithHexDump",function() {

        var obj = {  stuff: new Buffer("ABCDEF") };

        obj = utils.replaceBufferWithHexDump(obj);

        obj.should.eql({  stuff: "<BUFFER>414243444546</BUFFER>" });

    });
    it("should stress display_trace_from_this_projet_only at least once, for code covering purpose",function() {

        utils.display_trace_from_this_projet_only();

    });

    it("make_debugLog",function() {

        var tmp= process.env.DEBUG;

        process.env.DEBUG= '<some file>';
        var debugLog = utils.make_debugLog("<some file>");

        debugLog("help!");

        delete process.env.DEBUG;

    });

    it("compare_buffers",function(){

        var buf1 = new Buffer("ABC");
        var buf2 = new Buffer("XBC");
        utils.compare_buffers(buf1,buf2);

    })
    it("dumpIf",function(){

        utils.dumpIf(true,{ "hello": "world"});
    });

});

var fs = require("fs");
describe("testing redirectToFile",function(){

    it("should redirectToFile with a sync function", function(){

        utils.redirectToFile("redirectToFile_without_callback.log",function() {
            console.log("Hello World");
        });
    });

    it("should redirectToFile with a  callback", function(done){

        utils.redirectToFile("redirectToFile_with_a_callback.log",function() {
            console.log("Hello World");
        },done);
    });

    it("should redirectToFile with a sync function", function(){

        utils.redirectToFile("redirectToFile_sync.log",function(){

            console.log("Hello World");

        }, function(){

            var filename = utils.getTempFilename("redirectToFile_sync.log");
            var txt = fs.readFileSync(filename,"ascii");
            txt.should.eql("Hello World\n");

        });

    });

    function async_function(callback) {

       setImmediate(function() {
           console.log("Hello World !!!");
           callback();
       });
    }
    it("should redirectToFile with a async function", function(done) {


        utils.redirectToFile("redirectToFile_async.log",function(inner_done){
            async_function(inner_done);
        },function() {

            var filename = utils.getTempFilename("redirectToFile_async.log");
            var txt = fs.readFileSync(filename,"ascii");
            txt.should.eql("Hello World !!!\n");
            done();
        })
    });

});