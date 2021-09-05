"use strict";
/* global describe,it,before*/

import * as fs from "fs";
import { assert } from "node-opcua-assert";
import * as should from "should";

import { standardUnits } from "node-opcua-data-access";
import { DataType } from "node-opcua-variant";
import { nodesets, constructNodesetFilename } from "node-opcua-nodesets";
import { AddressSpace, UARootFolder, UAAnalogItem, UAObject, UAObjectType } from "..";
import { generateAddressSpace } from "../nodeJS";

interface MyCustomType extends UAObjectType {
    temperature: UAAnalogItem<number, DataType.Double>;
}
interface MyCustom extends UAObject {
    temperature: UAAnalogItem<number, DataType.Double>;
}

function createCustomType(addressSpace: AddressSpace): MyCustomType {
    const namespace = addressSpace.getOwnNamespace();
    // -------------------------------------------- MachineType
    const customTypeNode = namespace.addObjectType({ browseName: "CustomType" }) as MyCustomType;

    namespace.addAnalogDataItem({
        browseName: "Temperature",
        componentOf: customTypeNode,
        dataType: "Double",
        description: "Temperature",
        engineeringUnits: standardUnits.degree_celsius,
        engineeringUnitsRange: { low: -100, high: 200 },
        instrumentRange: { low: -70, high: 120 },
        modellingRule: "Mandatory",
        valuePrecision: 0.01
    });

    customTypeNode.getComponentByName("Temperature")!.browseName.toString().should.eql("1:Temperature");

    assert(customTypeNode.temperature!.browseName.toString() === "1:Temperature");
    return customTypeNode;
}

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing add new DataType ", function (this: any) {
    this.timeout(Math.max(300000, this.timeout()));

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        const xml_file = nodesets.standard;
        fs.existsSync(xml_file).should.be.eql(true);
        await generateAddressSpace(addressSpace, xml_file);
        addressSpace.registerNamespace("Private");
    });
    after(async () => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });

    it("should instantiate an object whose type defines an analog item", () => {
        const customType = createCustomType(addressSpace);
        customType.temperature.browseName.toString().should.eql("1:Temperature");
        customType.temperature.valuePrecision!.browseName.toString().should.eql("ValuePrecision");
        customType.temperature.instrumentRange!.browseName.toString().should.eql("InstrumentRange");
        customType.temperature.instrumentRange!.readValue().value.value.low.should.eql(-70);
        customType.temperature.instrumentRange!.readValue().value.value.high.should.eql(120);

        const customNode1 = customType.instantiate({
            browseName: "TestNode",
            organizedBy: "RootFolder"
        }) as MyCustom;

        customNode1.browseName.toString().should.eql("1:TestNode");
        customNode1.temperature.browseName.toString().should.eql("1:Temperature");

        customNode1.temperature.valuePrecision!.browseName.toString().should.eql("ValuePrecision");
        customNode1.temperature.instrumentRange!.browseName.toString().should.eql("InstrumentRange");
        customNode1.temperature.instrumentRange!.readValue().value.value.low.should.eql(-70);
        customNode1.temperature.instrumentRange!.readValue().value.value.high.should.eql(120);
    });
});

describe("issue #108", () => {
    it("should verify that UAObjectType.instantiate works for complex ObjectTypes like DI and ADI (reading from old 1.02 NodeSet)", async () => {
        const addressSpace = AddressSpace.create();

        const xml_files = [
            nodesets.standard,
            constructNodesetFilename("1.02/Opc.Ua.Di.NodeSet2.xml"),
            constructNodesetFilename("1.02/Opc.Ua.Adi.NodeSet2.xml"),
            constructNodesetFilename("1.02/FTNIR.NodeSet2.xml")
        ];

        fs.existsSync(xml_files[0]).should.be.eql(true);
        fs.existsSync(xml_files[1]).should.be.eql(true);
        fs.existsSync(xml_files[2]).should.be.eql(true);
        fs.existsSync(xml_files[3]).should.be.eql(true);
        fs.existsSync(xml_files[0]).should.be.eql(true);

        await generateAddressSpace(addressSpace, xml_files);

        const deviceSet = addressSpace.findNode("RootFolder")! as UARootFolder;

        const ftnirType = addressSpace.findObjectType("3:FTNIRSimulatorDeviceType")!;

        // console.log(" ftnirType = ", ftnirType.toString());
        should.exist(ftnirType);

        const ftnirInstance = ftnirType.instantiate({ browseName: "MyFTNIR", organizedBy: deviceSet });

        ftnirInstance.nodeId.namespace.should.eql(addressSpace.getOwnNamespace().index);

        addressSpace.dispose();
    });
});
