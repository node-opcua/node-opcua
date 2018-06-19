const should = require("should");
const server_engine = require("../src/server_engine");

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

const doDebug = false;

describe("Testing the server  engine - View related ", function () {

    let engine;
    beforeEach(function (done) {
        engine = new server_engine.ServerEngine();
        engine.initialize({nodeset_filename: server_engine.mini_nodeset_filename}, function () {
            const FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            const BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });
    afterEach(function () {
        should.exist(engine);
        engine.shutdown();
        engine = null;
    });

    it("should create a view in the address space", function () {

        const viewsFolder = engine.addressSpace.findNode("ViewsFolder");

        const namespace = engine.addressSpace.getOwnNamespace();

        const view = namespace.addView({
            organizedBy: viewsFolder,
            browseName: "MyView"
        });
        if (doDebug) {
            console.log(view.toString());
        }
        view.browseName.toString().should.eql("1:MyView");
        //xx view.parentObj.browseName.toString().should.eql("Views");
    });
});
