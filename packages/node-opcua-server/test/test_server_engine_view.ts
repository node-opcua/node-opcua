import { promisify } from "node:util";
import { get_mini_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { ServerEngine } from "../source";
import { NodeId } from "node-opcua-nodeid";

const mini_nodeset_filename = get_mini_nodeset_filename();

const doDebug = false;

describe("Testing the server  engine - View related ", () => {
    let engine: ServerEngine;
    beforeEach(async () => {
        engine = new ServerEngine();
        await promisify(engine.initialize).call(engine, { nodeset_filename: mini_nodeset_filename });
        const _FolderTypeId = engine.addressSpace?.findNode("FolderType")?.nodeId;
        const _BaseDataVariableTypeId = engine.addressSpace?.findNode("BaseDataVariableType")?.nodeId;
    });
    afterEach(async () => {
        should.exist(engine);
        await engine.shutdown();
    });

    it("should create a view in the address space", () => {
        const viewsFolder = engine.addressSpace?.findNode("ViewsFolder") || NodeId.nullNodeId;
        should.exist(viewsFolder);

        if (!engine.addressSpace) throw new Error("addressSpace is null");
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
