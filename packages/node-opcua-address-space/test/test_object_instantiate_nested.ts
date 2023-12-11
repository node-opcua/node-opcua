import should from "should";
import { nodesets } from "node-opcua-nodesets";
import { coerceQualifiedName } from "node-opcua-data-model";

import { AddressSpace, Namespace, UAObjectType } from "..";
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
    let namespace: Namespace;
    let myDerivedType: UAObjectType;

    async function buildAddressSpace() {
        const addressSpace = AddressSpace.create();

        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);

        const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
        nsDI.should.be.greaterThanOrEqual(0);

        const topologyElementType = addressSpace.findObjectType("TopologyElementType", nsDI)!;

        namespace = addressSpace.registerNamespace("Private");

        const myBaseType = namespace.addObjectType({
            browseName: "MyBaseType",
            subtypeOf: topologyElementType
        });
        const uaParameterSet1 = namespace.addObject({
            browseName: coerceQualifiedName({ name: "ParameterSet", namespaceIndex: nsDI }),
            modellingRule: "Mandatory",
            componentOf: myBaseType
        });
        namespace.addVariable({
            browseName: "Foo",
            dataType: "String",
            modellingRule: "Mandatory",
            componentOf: uaParameterSet1
        });

        //
        myDerivedType = namespace.addObjectType({
            browseName: "MyDerivedType",
            subtypeOf: myBaseType,
            modellingRule: "Mandatory",
        });
        const uaParameterSet2 = namespace.addObject({
            browseName: coerceQualifiedName({ name: "ParameterSet", namespaceIndex: nsDI }),
            modellingRule: "Mandatory",
            componentOf: myDerivedType
        });
        namespace.addVariable({
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
        should.exist(uaParameterSet?.getComponentByName("Foo",2), "Manadatory ParameterSet.Foo property defined myDerivedType should exist ");
        should.exist(uaParameterSet?.getComponentByName("Bar",2), "Manadatory ParameterSet.Foo property defined myDerivedType superType, but missing in myDerivedType should exist ");
    });

    // See issue #1326.
    it("shold not add aggregates of ObjectType if name of that ObjectType conflict with name of other object", function () {
        const parameterSetType = namespace.addObjectType({
            browseName: "ParameterSet",
        });

        namespace.addVariable({
            browseName: "ExtraVar",
            dataType: "String",
            modellingRule: "Mandatory",
            componentOf: parameterSetType
        });

        const uaInstance = myDerivedType.instantiate({
            browseName: "MyInstance"
        });

        const uaParameterSet = uaInstance.getComponentByName("ParameterSet",1);
        should.not.exist(uaParameterSet?.getComponentByName("ExtraVar"), "Property ExtraVar from unrelated ObjectType added");
    });
});
