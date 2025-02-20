import { sameNodeId } from "node-opcua-nodeid";
import { AddressSpace, BaseNode, UARootFolder } from "..";
import { getMiniAddressSpace } from "../distHelpers";
import should from  "should";
import { BrowseDirection } from "node-opcua-data-model";

describe("AddressSpace : removeReference", ()=>{

    let addressSpace: AddressSpace;
    let rootFolder: UARootFolder;
    let variable1: BaseNode;
    let variable2: BaseNode;
    let obj: BaseNode & { variable1?: BaseNode, variable2?: BaseNode };
    
    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        rootFolder = addressSpace.rootFolder;
        rootFolder.browseName.toString().should.equal("Root");

        const namespace = addressSpace.getOwnNamespace();

         obj = namespace.addObject({
            browseName: "Object1"
        });

         variable1 = namespace.addVariable({
            browseName: "Variable1",
            componentOf: obj,
            dataType: "Double",
            value: { dataType: "Double", value: 3.14 },
            minimumSamplingInterval: 1000
        });

        variable2 = namespace.addVariable({
            browseName: "Variable2",
            componentOf: obj,
            dataType: "Double",
            value: { dataType: "Double", value: 3.14 },
            minimumSamplingInterval: 1000
        });

    });

    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    
    it("should remove a reference -> pre-condition ", ()=>{  
        should.exist(obj["variable1"]);
        should.exist(obj["variable2"]);
        should.exist(obj.getChildByName("Variable1"));  
        should.exist(obj.getChildByName("Variable2"));  
    });

    it("should remove a reference -> when deleting from parent", ()=>{

        const ref = obj.findReferences("HasComponent", true).filter((x)=>sameNodeId(x.nodeId, variable1.nodeId))[0];

        obj.removeReference(ref);

        should.not.exist(obj["variable1"]);
        should.not.exist(obj.getChildByName("Variable1"));  
        should.exist(obj["variable2"]);
        should.exist(obj.getChildByName("Variable2"));  
        

    });
    it("should remove a reference -> when deleting from child", ()=>{

        const ref = variable1.findReferencesEx("HasComponent", BrowseDirection.Inverse)[0];
        
        variable1.removeReference(ref);

        should.not.exist(obj["variable1"]);
        should.not.exist(obj.getChildByName("Variable1"));  
        should.exist(obj["variable2"]);
        should.exist(obj.getChildByName("Variable2"));  
    });

});