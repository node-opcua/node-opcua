require("requirish")._(module);
var assert = require("better-assert");
var path = require("path");
var should = require("should");


var Method = require("lib/address_space/ua_method").Method;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var UAObjectType = require("lib/address_space/ua_object_type").UAObjectType;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var DataType = require("lib/datamodel/variant").DataType;
var AttributeIds = require("lib/services/read_service").AttributeIds;
import AddressSpace from "lib/address_space/AddressSpace";
var generate_address_space = require("lib/address_space/load_nodeset2").generate_address_space;
var NodeId = require("lib/datamodel/nodeid").NodeId;

var browse_service = require("lib/services/browse_service");
var BrowseDirection = browse_service.BrowseDirection;

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
        console.log('Garbage collection unavailable.  Pass --expose-gc '
            + 'when launching node to enable forced garbage collection.');
    }
}


describe("Testing AddressSpace memory Leaks",function(){

    require("test/helpers/resource_leak_detector").installResourceLeakDetector();

    var xml_file = path.join(__dirname, "../../lib/server/mini.Node.Set2.xml");
    require("fs").existsSync(xml_file).should.be.eql(true);

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
