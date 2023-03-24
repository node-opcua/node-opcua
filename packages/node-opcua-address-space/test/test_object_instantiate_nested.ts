import * as should from "should";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";
import { coerceQualifiedName } from "node-opcua-data-model";

import { AddressSpace, getSymbols, IAddressSpace, SessionContext, setSymbols } from "..";
import { generateAddressSpace } from "../distNodeJS";



describe("Object Instantiate with various nested properties defined at different subType level", function () {
    /**
     * *    MyDeriveType  ------------------- -> MyBaseType    --------------> TopologyElementType
     *        |                                   |                                   |
     *        +- ParamaterSet                     +-> ParameterSet                    +-> ParamaterSet
     *                 |                                   |
     *                  +- Foo1                            |
     *                                                     +- Bar
     *
     *    Instance
     *       |
     *        +- ParamaterSet
     *                |
     *                +- Foo
     *                |
     *                +- Bar
     */

    let addressSpace: AddressSpace;
    let myDerivedType: any;

    async function buildAddressSpace() {
        const addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);

        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        nsDI.should.be.greaterThanOrEqual(0);
     
        const topologyElementType = addressSpace.findObjectType("TopologyElementType", nsDI)!;

        const n = addressSpace.registerNamespace("Private");

        const myBaseType = n.addObjectType({
            browseName: "MyBaseType",
            subtypeOf: topologyElementType
        });
        const uaParameterSet1 = n.addObject({
            browseName: coerceQualifiedName({ name: "ParameterSet", namespaceIndex: nsDI }),
            modellingRule: "Mandatory",
            componentOf: myBaseType
        });
        n.addVariable({
            browseName: "Foo",
            dataType: "String",
            modellingRule: "Mandatory",
            componentOf: uaParameterSet1
        });

        //
        myDerivedType = n.addObjectType({
            browseName: "MyDerivedType",
            subtypeOf: myBaseType,
            modellingRule: "Mandatory",
        });
        const uaParameterSet2 = n.addObject({
            browseName: coerceQualifiedName({ name: "ParameterSet", namespaceIndex: nsDI }),
            modellingRule: "Mandatory",
            componentOf: myDerivedType
        });
        n.addVariable({
            dataType: "String",
            browseName: "Bar",
            modellingRule: "Mandatory",
            componentOf: uaParameterSet2
        });

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
    it("should instantiate grand children of a property defined in the supertype", function () {
        const uaInstance = myDerivedType.instantiate({
            browseName: "MyInstance"
        });
        uaInstance.browseName.toString().should.eql("1:MyInstance");
        // console.log(uaInstance.toString());
        // console.log(uaInstance.getComponentByName("ParameterSet",1).toString());

        const uaParameterSet = uaInstance.getComponentByName("ParameterSet",1);
        should.exist(uaParameterSet);
        should.exist(uaParameterSet.getComponentByName("Foo",2), "Manadatory ParameterSet.Foo property defined myDerivedType should exist ");
        should.exist(uaParameterSet.getComponentByName("Bar",2), "Manadatory ParameterSet.Foo property defined myDerivedType superType, but missing in myDerivedType should exist ");

    });
});
