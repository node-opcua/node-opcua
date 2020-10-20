import * as should from "should";

import { NodeClass } from "node-opcua-data-model";
import { AddressSpace, Namespace } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new ObjectType ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });
    it("should add a new ObjectType (=> BaseObjectType)", () => {
        const myObjectType = namespace.addObjectType({ browseName: "MyObjectType" });
        myObjectType.browseName.toString().should.eql("1:MyObjectType");
        myObjectType.subtypeOfObj!.browseName.toString().should.eql("BaseObjectType");
        myObjectType.nodeClass.should.eql(NodeClass.ObjectType);
    });
    it("should add a new VariableType (=> BaseVariableType)", () => {
        const myVariableType = namespace.addVariableType({ browseName: "MyVariableType" });
        myVariableType.browseName.toString().should.eql("1:MyVariableType");
        myVariableType.subtypeOfObj!.browseName.toString().should.eql("BaseVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);
    });
    it("should add a new VariableType (=> BaseDataVariableType)", () => {
        const myVariableType = namespace.addVariableType({
            browseName: "MyVariableType2",
            subtypeOf: "BaseDataVariableType"
        });
        myVariableType.browseName.toString().should.eql("1:MyVariableType2");
        myVariableType.subtypeOfObj!.browseName.toString().should.eql("BaseDataVariableType");
        myVariableType.nodeClass.should.eql(NodeClass.VariableType);
    });
});
