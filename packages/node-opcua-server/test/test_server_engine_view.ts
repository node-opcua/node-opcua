import { promisify } from "node:util";
import should from "should";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { ServerEngine } from "../source";

const mini_nodeset_filename = get_mini_nodeset_filename();

const doDebug = false;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing the server  engine - View related ", function () {
    let engine: ServerEngine;
    beforeEach(async () => {
        engine = new ServerEngine();
        await promisify(engine.initialize).call(engine, { nodeset_filename: mini_nodeset_filename });
        const FolderTypeId = engine.addressSpace!.findNode("FolderType")!.nodeId;
        const BaseDataVariableTypeId = engine.addressSpace!.findNode("BaseDataVariableType")!.nodeId;
    });
    afterEach(async () => {
        should.exist(engine);
        await engine.shutdown();
    });

    it("should create a view in the address space", function () {
        const viewsFolder = engine.addressSpace!.findNode("ViewsFolder")!;
        should.exist(viewsFolder);

        const namespace = engine.addressSpace!.getOwnNamespace();

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
