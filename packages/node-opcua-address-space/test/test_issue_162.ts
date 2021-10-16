import * as fs from "fs";
import * as should from "should";

import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";

import { AddressSpace, UAObject, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

interface MyCustomObject extends UAObject {
    customProperty: UAVariable;
}

function findOrCreateCustomObjectType(addressSpace: AddressSpace) {
    let myCustomObjectType = addressSpace.findObjectType("1:MyCustomObjectType");

    if (!myCustomObjectType) {
        const namespace = addressSpace.getOwnNamespace();

        myCustomObjectType = namespace.addObjectType({
            browseName: "MyCustomObjectType"
        });
        const myCustomProperty = namespace.addVariable({
            browseName: "CustomProperty",
            dataType: "Double",
            description: "Descr",
            modellingRule: "Mandatory",
            propertyOf: myCustomObjectType,
            // If I skip this line, I can see in UaExpert that value of property in type definition
            // and instantiated object is broken.
            // If I leave it, I cannot bind value of CustomProperty after instantiation to custom value
            //   - it always is 1
            value: { dataType: DataType.Double, value: 1 }
        });
    }
    return myCustomObjectType;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Issue 162 : demonstrate how to modify an instantiate object variable", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();

        const xml_file = nodesets.standard;

        fs.existsSync(xml_file).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_file);
        const namespace = addressSpace.registerNamespace("Private");
        namespace.index.should.eql(1);
    });

    after(() => {
        addressSpace.dispose();
    });

    it("example from 162 - way 1 : using setValueFromSource", () => {
        const myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        const myObject = myCustomObjectType.instantiate({
            browseName: "MyObject",
            organizedBy: "RootFolder"
        }) as MyCustomObject;

        should(myObject).have.ownProperty("customProperty");
        // the first method consist of accessing the customProperty and
        // setting the value when ever it change from the outside.
        myObject.customProperty.setValueFromSource({ dataType: DataType.Double, value: -32 });

        // verification
        // xx console.log(myObject.customProperty.readValue().toString());
        myObject.customProperty.readValue().value.value.should.eql(-32);
    });

    it("example from 162 - way 2 : rebinding variable ", () => {
        const myCustomObjectType = findOrCreateCustomObjectType(addressSpace);

        const myObject = myCustomObjectType.instantiate({
            browseName: "MyObject2",
            organizedBy: "RootFolder"
        }) as MyCustomObject;

        // the  method consist of setting a getter and a setter
        let value = 3;

        const options = {
            get: () => {
                return new Variant({
                    dataType: DataType.Double,
                    value
                });
            },
            set: undefined
        };

        myObject.customProperty.bindVariable(options, true /*overwrite existing binding ? Yes !*/);

        myObject.customProperty.readValue().value.value.should.eql(3);

        value = 30;
        myObject.customProperty.readValue().value.value.should.eql(30);
    });
});
