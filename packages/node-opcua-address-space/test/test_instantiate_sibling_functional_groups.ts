import { BrowseDirection, coerceQualifiedName } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * Two functions of the same type, declared side by side in one type, must each keep their own
 * FunctionalGroup members once instantiated.
 *
 * OPC 30500 LADS: the Operational FunctionalGroup of a TwoStateDiscreteSensorFunctionType
 * organizes its SensorValue. `reconstructFunctionalGroupType` looked the FunctionalGroup up in
 * the FLAT list of every clone (`findImplementedObject` returned the first match). Both sensors
 * shadow the same originals of the LADS type, so SensorB's SensorValue was also organized by
 * SensorA's Operational: every function's Operational listed its siblings' values.
 * `reconstructNonHierarchicalReferences` had the same flaw (see
 * test_instantiate_two_alarms_substates.ts); this covers the FunctionalGroup pass.
 */
describe("sibling functions keep their own FunctionalGroup members", function (this: Mocha.Suite) {
    this.timeout(30000);
    let addressSpace: AddressSpace;
    let lads: number;
    let unitType: UAObjectType;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodesets.di,
            nodesets.amb,
            nodesets.ia,
            nodesets.machinery,
            nodesets.lads
        ]);
        const ns = addressSpace.getOwnNamespace();
        lads = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/LADS/");
        unitType = ns.addObjectType({
            browseName: "TwoSensorUnitType",
            subtypeOf: addressSpace.findObjectType("FunctionalUnitType", lads)!
        });
        const functionSet = addressSpace.findObjectType("FunctionSetType", lads)!.instantiate({
            browseName: coerceQualifiedName({ name: "FunctionSet", namespaceIndex: lads }),
            componentOf: unitType,
            modellingRule: "Mandatory",
            copyAlsoModellingRules: true
        });
        const sensorType = addressSpace.findObjectType("TwoStateDiscreteSensorFunctionType", lads)!;
        for (const name of ["SensorA", "SensorB"]) {
            sensorType.instantiate({
                browseName: name,
                componentOf: functionSet,
                modellingRule: "Mandatory",
                copyAlsoModellingRules: true
            });
        }
    });
    after(() => {
        addressSpace.dispose();
    });

    function organizedByOperational(unit: UAObject, sensor: string) {
        const fn = unit.getChildByName("FunctionSet", lads)!.getChildByName(sensor)!;
        const operational = fn.getChildByName("Operational", lads)!;
        const sensorValue = fn.getChildByName("SensorValue", lads)!;
        const organized = operational.findReferencesExAsObject("Organizes", BrowseDirection.Forward);
        return { organized, sensorValue };
    }

    it("SFG-1 each Operational organizes only its own SensorValue", () => {
        const unit = unitType.instantiate({ browseName: "Unit", organizedBy: addressSpace.rootFolder.objects });
        for (const sensor of ["SensorA", "SensorB"]) {
            const { organized, sensorValue } = organizedByOperational(unit, sensor);
            const sensorValues = organized.filter((n) => n.browseName.name === "SensorValue");
            should(sensorValues.map((n) => n.nodeId.toString())).eql([sensorValue.nodeId.toString()], sensor);
        }
    });

    it("SFG-2 the same holds when the unit is itself a member of another type", () => {
        const holderType = addressSpace.getOwnNamespace().addObjectType({ browseName: "HolderType" });
        const unit = unitType.instantiate({
            browseName: "Unit",
            componentOf: holderType,
            modellingRule: "Mandatory",
            copyAlsoModellingRules: true
        });
        for (const sensor of ["SensorA", "SensorB"]) {
            const { organized, sensorValue } = organizedByOperational(unit, sensor);
            const sensorValues = organized.filter((n) => n.browseName.name === "SensorValue");
            should(sensorValues.map((n) => n.nodeId.toString())).eql([sensorValue.nodeId.toString()], sensor);
        }
    });
});
