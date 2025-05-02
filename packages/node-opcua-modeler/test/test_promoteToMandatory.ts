import should from "should";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { exploreNode } from "node-opcua-address-space-base";
import {
    AddressSpace,
    assert,
    DataType,
    displayNodeElement,
    Namespace,
    NodeClass,
    nodesets,
    promoteChild,
    promoteToMandatory,
    UAObject
} from "..";

import { removeDecoration } from "./test_helpers";

const namespaceUri = "urn:some";

function createModel(addressSpace: AddressSpace) {
    /* empty */
}

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("promoteToMandatory", () => {
    let addressSpace: AddressSpace;
    let nsDI: number;
    let ns: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        ns = addressSpace.registerNamespace(namespaceUri);
        const nodesetsXML = [nodesets.standard, nodesets.di];

        await generateAddressSpace(addressSpace, nodesetsXML);
        createModel(addressSpace);

        nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        if (nsDI < 0) {
            throw new Error("Cannot find DI namespace!");
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    it("PRMT-1 when creating a sub type it should be possible to promote a component or property to mandatory", async () => {
        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DeviceType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType",
            subtypeOf: deviceType
        });

        const deviceClass = promoteToMandatory(boilerType, "DeviceClass", nsDI);
        deviceClass.browseName.toString().should.eql(`${nsDI}:DeviceClass`);
        deviceClass.nodeClass.should.eql(NodeClass.Variable);
        deviceClass.modellingRule!.should.eql("Mandatory");

        const deviceHealth = promoteToMandatory(boilerType, "DeviceHealth", nsDI);
        deviceHealth.browseName.toString().should.eql(`${nsDI}:DeviceHealth`);
        deviceHealth.nodeClass.should.eql(NodeClass.Variable);
        deviceHealth.modellingRule!.should.eql("Mandatory");

        const str1 = displayNodeElement(boilerType);
        const a = removeDecoration(str1).split("\n");
        // console.log(a);

        // a[2 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=1;i=1001  │ 2:DeviceHealth         │ Mandatory           │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
        // a[13 * 2 + 1].should.eql(`│ HasComponent Ⓥ         │ ns=2;i=6208  │ 2:DeviceHealth         │ Optional            │ BaseDataVariableType  │ 2:DeviceHealthEnumeration(Variant) │ null  │`);
    });

    it("PRMT-2 when creating a sub type it should be possible to promote a component or property to mandatory, and child node shall not be duplicated", async () => {
        const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
        if (!deviceType) {
            throw new Error("Cannot find DeviceType");
        }

        const boilerType = ns.addObjectType({
            browseName: "BoilerType1",
            subtypeOf: deviceType
        });

        const parameterSet = promoteToMandatory(boilerType, "ParameterSet", nsDI);

        should.exist(boilerType.getComponentByName("ParameterSet", nsDI));

        ns.addVariable({
            browseName: "Parameter1",
            dataType: DataType.Int32,
            componentOf: parameterSet,
            modellingRule: "Mandatory"
        });
        const param1 = parameterSet.getChildByName("Parameter1", ns.index);
        should.exist(param1);
        {
            const specialBoilerType = ns.addObjectType({
                browseName: "BoilerType2",
                subtypeOf: boilerType
            });
            const parameterSet2 = promoteChild(specialBoilerType, "ParameterSet", nsDI);

            const param2 = parameterSet2.getChildByName("Parameter1", ns.index)!;
            should.exist(param2);
            param2.modellingRule!.should.eql("Mandatory");

            const specialBoiler = specialBoilerType.instantiate({
                browseName: "SpecialBoiler",
                organizedBy: addressSpace.rootFolder.objects
            });
            const parameterSet3 = specialBoiler.getChildByName("ParameterSet", nsDI)!;
            should.exist(parameterSet3);

            const param3 = parameterSet3.getChildByName("Parameter1", ns.index)!;
            should.exist(param3);
            should.not.exist(param3.modellingRule, " instance property should not have a modelling rule");
        }
    });

    it("PRMT-3 should clone the organized nodes", () => {
        //       -----|>|>  BaseObjectType
        //       |
        // MyObjectType   <|<|---------- DerivedObjectType
        //   Folder1                          Folder1  ( promoted)
        //      Variable1                         Variable1 (promoted)
        //                                           EURange
        //   Folder2
        //      Variable1

        const functionalGroupType = addressSpace.findObjectType("FunctionalGroupType", 2)!;

        const namespace = addressSpace.getOwnNamespace();
        const objectType = namespace.addObjectType({
            browseName: "MyObjectType",
            subtypeOf: "BaseObjectType"
        });

        const folder1 = namespace.addObject({
            browseName: "Folder1",
            componentOf: objectType,
            typeDefinition: functionalGroupType,
            modellingRule: "Mandatory"
        });

        const folder2 = namespace.addObject({
            browseName: "Folder2",
            componentOf: objectType,
            typeDefinition: functionalGroupType,
            modellingRule: "Mandatory"
        });

        const variable1 = namespace.addVariable({
            browseName: "Variable1",
            componentOf: folder1,
            dataType: "Double",
            modellingRule: "Mandatory"
        });
        folder2.addReference({
            referenceType: "Organizes",
            nodeId: variable1.nodeId,
            isForward: true
        });

        exploreNode(objectType);

        {
            const objInstance = objectType.instantiate({
                browseName: "MyInstance",
                organizedBy: addressSpace.rootFolder.objects
            });

            exploreNode(objInstance);


            objInstance.typeDefinitionObj.browseName.name!.should.eql("MyObjectType");
            const folder1InInstance = objInstance.getComponentByName("Folder1")! as UAObject;
            const folder2InInstance = objInstance.getComponentByName("Folder2")! as UAObject;

            const variable1_in_Folder1 = folder1InInstance.getComponentByName("Variable1")!;
            const variable1_in_Folder2 = folder2InInstance.getFolderElementByName("Variable1")!;

            variable1_in_Folder1.nodeId.toString().should.eql(variable1_in_Folder2.nodeId.toString());
        }

        // now create a derived type
        const derivedObjectType = namespace.addObjectType({
            browseName: "DerivedObjectType",
            subtypeOf: objectType
        });

        /** 
        const folder1_bis = namespace.addObject({
            componentOf: derivedObjectType,
            modellingRule: "Mandatory",
            browseName: folder1.browseName,
            displayName: folder1.displayName,
            description: folder1.description
        });
        const variable1_bis = variable1.clone({
            componentOf: folder1_bis,
            namespace: folder1_bis.namespace,
            copyAlsoModellingRules: true
        });
        */
        console.log("A1-!!!!!!!!!!!!!!!!");
        const folder1_bis = promoteChild(derivedObjectType, "Folder1", 1) as UAObject;

        exploreNode(derivedObjectType);
        

        console.log("A2-!!!!!!!!!!!!!!!!");
        const variable1_bis = folder1_bis.getComponentByName("Variable1")!;
        const euRange = namespace.addVariable({
            browseName: "EURange",
            componentOf: variable1_bis,
            dataType: "Double",
            modellingRule: "Mandatory"
        });

        exploreNode(derivedObjectType);

        {
            console.log("B-!!!!!!!!!!!!!!!!");
            const objInstance = derivedObjectType.instantiate({
                browseName: "MyInstance2",
                organizedBy: addressSpace.rootFolder.objects
            });
            objInstance.typeDefinitionObj.browseName.name!.should.eql("DerivedObjectType");
            objInstance.typeDefinitionObj.subtypeOfObj!.browseName.name!.should.eql("MyObjectType");
            const folder1InInstance = objInstance.getComponentByName("Folder1")! as UAObject;
            const folder2InInstance = objInstance.getComponentByName("Folder2")! as UAObject;

            const variable1_in_Folder1 = folder1InInstance.getComponentByName("Variable1")!;
            const variable1_in_Folder2 = folder2InInstance.getFolderElementByName("Variable1")!;

            variable1_in_Folder1.nodeId.toString().should.eql(variable1_in_Folder2.nodeId.toString());
        }
    });
});
