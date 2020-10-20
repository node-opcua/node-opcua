import * as should from "should";

import { BrowseDirection } from "node-opcua-data-model";

import { AddressSpace, UAObject, UAObjectType, UAVariable } from "..";
import { getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new ObjectType ", () => {

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = await getMiniAddressSpace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("should instantiate a objectType that uses custom HasChild Property", () => {

        const namespace = addressSpace.getOwnNamespace();
        // ------------ Add a new aggregate
        const weezbeChildType = namespace.addReferenceType({
            browseName: "HasWeezbe",
            inverseName: "WeezbeOf",
            isAbstract: false,
            subtypeOf: "Aggregates"
        });

        const myObjectType = namespace.addObjectType({
            browseName: "MyObjectType"
        });

        const weezbeChild = namespace.addObject({
            browseName: "MyWeezBe",
            modellingRule: "Mandatory"
        });

        myObjectType.addReference({
            nodeId: weezbeChild,
            referenceType: weezbeChildType.nodeId,
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

        instance.findReferencesEx("1:HasWeezbe", BrowseDirection.Forward).length.should.eql(1);

        const c = instance.getChildByName("MyWeezBe");
        should.exist(c);

    });

    interface MySubObjectType1  extends UAObjectType {
        property1: UAVariable;
        property2: UAVariable;
    }
    interface MySubObject1  extends UAObject {
        property1: UAVariable;
        property2: UAVariable;
    }
    interface MyObjectType1 extends UAObjectType {
        subObj: MySubObject1;
    }
    interface MyObject1 extends UAObject {
        subObj: MySubObject1;
    }

    it("should be possible to choose which optional item to instantiate in sub objects", () => {
        const namespace = addressSpace.getOwnNamespace();

        function constructObjectType() {

            const mySubObjectType1 = namespace.addObjectType({
                browseName: "MySubObjectType1"
            }) as MySubObjectType1;
            const prop1 = namespace.addVariable({
                browseName: "Property1",
                dataType: "Double",
                modellingRule: "Mandatory",
                propertyOf: mySubObjectType1,
            });

            mySubObjectType1.property1.browseName.toString().should.eql("1:Property1");

            const prop2 = namespace.addVariable({
                browseName: "Property2",
                dataType: "Double",
                modellingRule: "Optional",
                propertyOf: mySubObjectType1,
            });
            const prop3 = namespace.addVariable({
                browseName: "Property3",
                dataType: "Double",
                modellingRule: "Optional",
                propertyOf: mySubObjectType1,
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

        }

        constructObjectType();

        const myObjectType1 = addressSpace.findObjectType("1:MyObjectType1")!;

        // -----------------------------------------------
        const obj1 = myObjectType1.instantiate({
            browseName: "Obj1",
            organizedBy: addressSpace.rootFolder.objects,
        }) as MyObject1;
        should(obj1.getComponentByName("SubObj")).eql(null);

        // -----------------------------------------------
        const obj2 = myObjectType1.instantiate({
            browseName: "Obj2",
            optionals: ["SubObj"],
            organizedBy: addressSpace.rootFolder.objects,
        }) as MyObject1;

        should.exist(obj2.getComponentByName("SubObj"));
        obj2.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj2.subObj.getPropertyByName("Property1"));
        should.not.exist(obj2.subObj.getPropertyByName("Property2"));
        should.not.exist(obj2.subObj.getPropertyByName("Property3"));

        // -----------------------------------------------
        const obj3 = myObjectType1.instantiate({
            browseName: "Obj3",
            optionals: [
                "SubObj.Property2",
                "SubObj.Property3"
            ],
            organizedBy: addressSpace.rootFolder.objects,

        }) as MyObject1;
        obj3.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj3.subObj.getPropertyByName("Property1"));
        should.exist(obj3.subObj.getPropertyByName("Property2"));
        should.exist(obj3.subObj.getPropertyByName("Property3"));

        // -----------------------------------------------
        const obj4 = myObjectType1.instantiate({
            browseName: "Obj4",
            optionals: [
                "SubObj.Property3"
            ],
            organizedBy: addressSpace.rootFolder.objects,
        }) as MyObject1;

        obj4.getComponentByName("SubObj")!.browseName.toString().should.eql("1:SubObj");

        should.exist(obj4.subObj.getPropertyByName("Property1"));
        should.not.exist(obj4.subObj.getPropertyByName("Property2"));
        should.exist(obj4.subObj.getPropertyByName("Property3"));
    });

});
