import should from "should";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { BrowseDirection } from "node-opcua-data-model";

import { AddressSpace, getSymbols, IAddressSpace, SessionContext, setSymbols, UAObject } from "..";
import { generateAddressSpace } from "../nodeJS";

const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Test object instantiate when organizes references exists", () => {
    let addressSpace: AddressSpace;

    async function buildAddressSpace() {
        const addressSpace = AddressSpace.create();

        const n = addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodesets.commercialKitchenEquipment]);
        return addressSpace;
    }
    beforeEach(async () => {
        addressSpace = await buildAddressSpace();
    });
    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("ION-1 - should clone the organized nodes", () => {

        const functionalGroupType = addressSpace.findObjectType("FunctionalGroupType", 2)!;

        const namespace = addressSpace.getOwnNamespace();
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });
        
        const folder1 = namespace.addObject({
            browseName: "Folder1",
            organizedBy: objectType,
            typeDefinition: functionalGroupType,
            modellingRule: "Mandatory"
        });

        const objInstance = objectType.instantiate({
            browseName: "MyInstance",
            organizedBy: addressSpace.rootFolder.objects
        });
        objInstance.typeDefinitionObj.browseName.name!.should.eql("MyObjectType");

        const folder1InInstance = objInstance.getFolderElementByName("Folder1");
        // console.log(folder1InInstance?.toString());

        should.exist(folder1InInstance, "Element organized by should be instantiates");

        should.not.exist(folder1InInstance?.modellingRule, "folder1 in instance must not have a modelling rule");
    });

    it("ION-2 - should clone the organized nodes", () => {
        const functionalGroupType = addressSpace.findObjectType("FunctionalGroupType", 2)!;

        //  MyObjectType (A)
        //     |
        //     +----------||-ParameterSet (B)
        //     |                |
        //     |                +---------||- Parameter1 (C)
        //     |
        //     +-organizes-> Folder1  (D)
        //     |                |
        //                      --organizes-> Parameter1 (C)

        const namespace = addressSpace.getOwnNamespace();
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });

        const parameterSet = namespace.addObject({
            browseName: "ParameterSet",
            componentOf: objectType,
            modellingRule: "Mandatory"
        });
        const parameter1 = namespace.addVariable({
            browseName: "Parameter1",
            dataType: "Double",
            componentOf: parameterSet,
            modellingRule: "Mandatory"
        });

        const folder1 = namespace.addObject({
            browseName: "Folder1",
            organizedBy: objectType,
            typeDefinition: functionalGroupType,
            modellingRule: "Mandatory"
        });

        folder1.addReference({
            referenceType: "Organizes",
            nodeId: parameter1
        });

        const objInstance = objectType.instantiate({
            browseName: "MyInstance",
            organizedBy: addressSpace.rootFolder.objects
        });
        objInstance.typeDefinitionObj.browseName.name!.should.eql("MyObjectType");

        const parameter1InInstanceAsStoredInParameterSet = objInstance
            .getChildByName("ParameterSet", 1)!
            .getChildByName("Parameter1")!;
        parameter1InInstanceAsStoredInParameterSet.browseName.name!.should.eql("Parameter1");

        const folder1InInstance = objInstance.getFolderElementByName("Folder1");
        // console.log(folder1InInstance?.toString());

        should.exist(folder1InInstance, "Element organized by should be instantiates");
        should.not.exist(folder1InInstance?.modellingRule, "folder1 in instance must not have a modelling rule");

        folder1InInstance?.findReferencesEx("Organizes", BrowseDirection.Forward).length.should.eql(1);
        const parameter1InInstanceAsStoredInFolder1 = folder1InInstance!.findReferencesExAsObject(
            "Organizes",
            BrowseDirection.Forward
        )[0]!;
        parameter1InInstanceAsStoredInFolder1.browseName
            .toString()
            .should.eql(parameter1InInstanceAsStoredInParameterSet.browseName.toString());

        parameter1InInstanceAsStoredInFolder1.nodeId.should.eql(parameter1InInstanceAsStoredInParameterSet.nodeId);

        console.log(folder1InInstance?.toString());
    });

    it("ION-3 - should clone the organized nodes (folder1 created before parameter set)", () => {

        const functionalGroupType = addressSpace.findObjectType("FunctionalGroupType", 2)!;

        const namespace = addressSpace.getOwnNamespace();
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });
        // in this 
        const folder1 = namespace.addObject({
            browseName: "Folder1",
            organizedBy: objectType,
            typeDefinition: functionalGroupType,
            modellingRule: "Mandatory"
        });        
        const parameterSet = namespace.addObject({
            browseName: "ParameterSet",
            componentOf: objectType,
            modellingRule: "Mandatory"
        });
        const parameter1 = namespace.addVariable({
            browseName: "Parameter1",
            dataType: "Double",
            componentOf: parameterSet,
            modellingRule: "Mandatory"
        });
        
        folder1.addReference({ 
            referenceType: "Organizes", 
            nodeId: parameter1
        });

        const objInstance = objectType.instantiate({
            browseName: "MyInstance",
            organizedBy: addressSpace.rootFolder.objects
        });
        objInstance.typeDefinitionObj.browseName.name!.should.eql("MyObjectType");

        const parameter1InInstanceAsStoredInParameterSet = objInstance.getChildByName("ParameterSet", 1)!.getChildByName("Parameter1")!;
        parameter1InInstanceAsStoredInParameterSet.browseName.name!.should.eql("Parameter1");

        const folder1InInstance = objInstance.getFolderElementByName("Folder1");
        // console.log(folder1InInstance?.toString());

        should.exist(folder1InInstance, "Element organized by should be instantiates");
        should.not.exist(folder1InInstance?.modellingRule, "folder1 in instance must not have a modelling rule");

        folder1InInstance?.findReferencesEx("Organizes", BrowseDirection.Forward).length.should.eql(1);
        const parameter1InInstanceAsStoredInFolder1 = folder1InInstance!.findReferencesExAsObject("Organizes", BrowseDirection.Forward)[0]! ;
        parameter1InInstanceAsStoredInFolder1.browseName.toString().should.eql(parameter1InInstanceAsStoredInParameterSet.browseName.toString());
 
        parameter1InInstanceAsStoredInFolder1.nodeId.toString().should.eql(parameter1InInstanceAsStoredInParameterSet.nodeId.toString());
        
        doDebug && console.log(folder1InInstance?.toString());
    });

});
