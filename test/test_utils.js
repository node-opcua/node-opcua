var utils  =require("../lib/utils");
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

    })
    it("display_trace_from_this_projet_only",function() {

        utils.display_trace_from_this_projet_only();

    });
    it("make_debugLog",function() {

        var tmp= process.env.DEBUG;
        process.env.DEBUG= 'ALL';
        var debugLog = utils.make_debugLog("<some file>");

        debugLog("help!");

        process.env.DEBUG= tmp;

    });

    it("compare_buffers",function(){

        var buf1 = new Buffer("ABC");
        var buf2 = new Buffer("XBC");
        utils.compare_buffers(buf1,buf2);

    })
});
