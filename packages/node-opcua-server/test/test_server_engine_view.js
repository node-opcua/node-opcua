const should = require("should");

const { get_mini_nodeset_filename } = require("node-opcua-address-space/testHelpers");
const mini_nodeset_filename = get_mini_nodeset_filename();

const ServerEngine = require("..").ServerEngine;
const SubscriptionState = require("..").SubscriptionState;

const doDebug = false;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing the server  engine - View related ", function () {
    let engine;
    beforeEach(function (done) {
        engine = new ServerEngine();
        engine.initialize({ nodeset_filename: mini_nodeset_filename }, function () {
            const FolderTypeId = engine.addressSpace.findNode("FolderType").nodeId;
            const BaseDataVariableTypeId = engine.addressSpace.findNode("BaseDataVariableType").nodeId;
            done();
        });
    });
    afterEach(async () => {
        should.exist(engine);
        await engine.shutdown();
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
