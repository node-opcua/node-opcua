
var should = require("should");
var server_engine = require("../src/server_engine");

var resourceLeakDetector = require("node-opcua-test-helpers/src/resource_leak_detector").resourceLeakDetector;

describe("Testing the server  engine - View related ", function () {

    var engine;
    beforeEach(function (done) {
        resourceLeakDetector.start();
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            var FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            var BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });
    afterEach(function () {
        should.exist(engine);
        engine.shutdown();
        engine = null;
        resourceLeakDetector.stop();
    });

    it("should create a view in the address space", function () {

        var viewsFolder = engine.addressSpace.findNode("ViewsFolder");

        var view = engine.addressSpace.addView({
            organizedBy: viewsFolder,
            browseName: "MyView"
        });
        console.log(view.toString());
        view.browseName.toString().should.eql("MyView");
        //xx view.parentObj.browseName.toString().should.eql("Views");
    });
});
