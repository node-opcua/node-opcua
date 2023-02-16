import * as should from "should";

import { BrowseDirection } from "node-opcua-data-model";
import { sameNodeId } from "node-opcua-nodeid";

import { AddressSpace, UAObject, UAObjectType, UAReferenceType, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new ObjectType ", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();

        function constructObjectType() {
            const namespace = addressSpace.getOwnNamespace();
            const mySubObjectType1 = namespace.addObjectType({
                browseName: "MySubObjectType1"
            }) as MySubObjectType1;
            const prop1 = namespace.addVariable({
                browseName: "Property1",
                dataType: "Double",
                modellingRule: "Mandatory",
                propertyOf: mySubObjectType1
            });

            mySubObjectType1.property1.browseName.toString().should.eql("1:Property1");

            const prop2 = namespace.addVariable({
                browseName: "Property2",
                dataType: "Double",
                modellingRule: "Optional",
                propertyOf: mySubObjectType1
            });
            const prop3 = namespace.addVariable({
                browseName: "Property3",
                dataType: "Double",
                modellingRule: "Optional",
                propertyOf: mySubObjectType1
            });

            const myObjectType2 = namespace.addObjectType({
                browseName: "MyObjectType1"
            }) as MyObjectType1;

            const subObj = mySubObjectType1.instantiate({
                browseName: "SubObj",
                componentOf: myObjectType2,
                modellingRule: "Optional",
                optionals: ["Property2", "Property3"]
            }) as MySubObject1;

            myObjectType2.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");
            myObjectType2.subObj.getPropertyByName("Property1")!.browseName.toString().should.eql("1:Property1");
            myObjectType2.subObj.getPropertyByName("Property2")!.browseName.toString().should.eql("1:Property2");
            myObjectType2.subObj.getPropertyByName("Property3")!.browseName.toString().should.eql("1:Property3");

            myObjectType2.subObj.modellingRule!.should.eql("Optional");
            myObjectType2.subObj.property1.modellingRule!.should.eql("Mandatory");
            myObjectType2.subObj.property2.modellingRule!.should.eql("Optional");
            myObjectType2.subObj.property3.modellingRule!.should.eql("Optional");
        }
        constructObjectType();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should instantiate a objectType that uses custom HasChild Property", () => {
        addressSpace.isFrugal.should.eql(false);
        const aggregatesReference = addressSpace.findReferenceType("Aggregates")!;

        const namespace = addressSpace.getOwnNamespace();
        // ------------ Add a new aggregate
        const hasWeezbeReferenceType = namespace.addReferenceType({
            browseName: "HasWeezbe",
            inverseName: "WeezbeOf",
            isAbstract: false,
            subtypeOf: aggregatesReference
        });

        hasWeezbeReferenceType.subtypeOfObj!.browseName.toString().should.eql("Aggregates");
        sameNodeId(hasWeezbeReferenceType.subtypeOf!, aggregatesReference.nodeId).should.eql(true);
        hasWeezbeReferenceType.subtypeOfObj!.should.eql(aggregatesReference);

        //xx console.log(hasWeezbeReferenceType.isSubtypeOf(aggregatesReference));
        //xx console.log(aggregatesReference.isSubtypeOf(hasWeezbeReferenceType));

        hasWeezbeReferenceType.isSubtypeOf(aggregatesReference).should.eql(true);
        const a: UAReferenceType[] = aggregatesReference.getAllSubtypes();
        //xx console.log(a.map(a => a.browseName.toString()));

        const hasChildReference = aggregatesReference.subtypeOfObj!;
        const b: UAReferenceType[] = hasChildReference.getAllSubtypes();
        //xx console.log(b.map(b => b.browseName.toString()));

        //xx console.log(hasWeezbeReferenceType.toString());

        const myObjectType = namespace.addObjectType({
            browseName: "MyObjectType"
        });

        const weezbeChild = namespace.addObject({
            browseName: "MyWeezBe",
            modellingRule: "Mandatory"
        });

        myObjectType.addReference({
            nodeId: weezbeChild,
            referenceType: hasWeezbeReferenceType.nodeId
        });

        let aggregates = myObjectType.getAggregates();
        // xx console.log("myObjectType aggregates=  ",
        // aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);

        const instance = myObjectType.instantiate({
            browseName: "Instance"
        });
        instance.browseName.toString().should.eql("1:Instance");

        aggregates = instance.getAggregates();
        // xx console.log("equipmentType children=  ",
        // aggregates.map(function(c){ return c.browseName.toString(); }).join(" "));
        aggregates.length.should.eql(1);

        //xx console.log(instance.toString());

        instance.findReferencesEx("Aggregates", BrowseDirection.Forward).length.should.eql(1);
        instance.findReferencesEx("HasChild", BrowseDirection.Forward).length.should.eql(1);

        instance.findReferencesEx("1:HasWeezbe", BrowseDirection.Forward).length.should.eql(1);
        //xx console.log("ins", instance.toString());
        const c = instance.getChildByName("MyWeezBe");
        should.exist(c);
    });

    interface MySubObjectType1 extends UAObjectType {
        property1: UAVariable;
        property2: UAVariable;
    }
    interface MySubObject1 extends UAObject {
        property1: UAVariable;
        property2: UAVariable;
        property3: UAVariable;
    }
    interface MyObjectType1 extends UAObjectType {
        subObj: MySubObject1;
    }
    interface MyObject1 extends UAObject {
        subObj: MySubObject1;
    }

    it("should be possible to choose which optional item to instantiate in sub objects", () => {
        const myObjectType1 = addressSpace.findObjectType("1:MyObjectType1")!;

        // -----------------------------------------------
        const obj1 = myObjectType1.instantiate({
            browseName: "Obj1",
            organizedBy: addressSpace.rootFolder.objects
        }) as MyObject1;
        should(obj1.getComponentByName("SubObj")).eql(null);

        // -----------------------------------------------
        const obj2 = myObjectType1.instantiate({
            browseName: "Obj2",
            optionals: ["SubObj"],
            organizedBy: addressSpace.rootFolder.objects
        }) as MyObject1;

        should.exist(obj2.getComponentByName("SubObj"));
        obj2.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj2.subObj.getPropertyByName("Property1"));
        should.not.exist(obj2.subObj.getPropertyByName("Property2"));
        should.not.exist(obj2.subObj.getPropertyByName("Property3"));

        // -----------------------------------------------
        const obj3 = myObjectType1.instantiate({
            browseName: "Obj3",
            optionals: ["SubObj.Property2", "SubObj.Property3"],
            organizedBy: addressSpace.rootFolder.objects
        }) as MyObject1;
        obj3.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj3.subObj.getPropertyByName("Property1"));
        should.exist(obj3.subObj.getPropertyByName("Property2"));
        should.exist(obj3.subObj.getPropertyByName("Property3"));

        // -----------------------------------------------
        const obj4 = myObjectType1.instantiate({
            browseName: "Obj4",
            optionals: ["SubObj.Property3"],
            organizedBy: addressSpace.rootFolder.objects
        }) as MyObject1;

        obj4.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj4.subObj.getPropertyByName("Property1"));
        should.not.exist(obj4.subObj.getPropertyByName("Property2"));
        should.exist(obj4.subObj.getPropertyByName("Property3"));
    });

    it("should not replicate HasModelling Reference during instantiation if top most parent node is not a Type", () => {
        const namespace = addressSpace.getOwnNamespace();

        const myObjectType1 = addressSpace.findObjectType("1:MyObjectType1")!;

        // -----------------------------------------------
        const obj1 = myObjectType1.instantiate({
            browseName: "Obj10",
            organizedBy: addressSpace.rootFolder.objects,
            optionals: ["SubObj"]
        }) as MyObject1;

        should(obj1.getComponentByName("SubObj")).not.eql(null);

        should(obj1.subObj.modellingRule).eql(null);
    });
});
