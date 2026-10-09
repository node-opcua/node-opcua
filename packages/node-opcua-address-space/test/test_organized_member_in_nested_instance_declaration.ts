import { BrowseDirection, coerceQualifiedName } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, setSymbols, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * A member that a folder organizes, inside an instance declaration of a type that is itself
 * instantiated inside another type.
 *
 * OPC 30500 LADS TwoStateDiscreteControlFunctionType: its Operational FunctionalGroup organizes
 * the Stop Method of its state machine. A FunctionalUnit type holding such a function, built as
 * a member of a device type, took Stop from the unit type's Operational, then a second time when
 * the type definition's Operational was merged in as a base declaration: with symbolic names it
 * failed with "node Stop ... already registered", without them it got two Stop.
 */
describe("a member a folder organizes, in a nested instance declaration", function (this: Mocha.Suite) {
    this.timeout(30000);
    let addressSpace: AddressSpace;
    let lads: number;
    let unitType: UAObjectType;
    let deviceType: UAObjectType;

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
        setSymbols(ns, []);
        lads = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/LADS/");
        unitType = ns.addObjectType({
            browseName: "LoaderUnitType",
            subtypeOf: addressSpace.findObjectType("FunctionalUnitType", lads)!
        });
        const functionSet = addressSpace.findObjectType("FunctionSetType", lads)!.instantiate({
            browseName: coerceQualifiedName({ name: "FunctionSet", namespaceIndex: lads }),
            componentOf: unitType,
            modellingRule: "Mandatory",
            copyAlsoModellingRules: true
        });
        addressSpace.findObjectType("TwoStateDiscreteControlFunctionType", lads)!.instantiate({
            browseName: "Cover",
            componentOf: functionSet,
            modellingRule: "Mandatory",
            copyAlsoModellingRules: true
        });
        deviceType = ns.addObjectType({ browseName: "LoaderDeviceType" });
    });
    after(() => {
        addressSpace.dispose();
    });

    it("OMNI-1 the type holding it is built inside another type, with one Stop", () => {
        let loader: UAObject | undefined;
        should(() => {
            loader = unitType.instantiate({
                browseName: "Loader",
                componentOf: deviceType,
                modellingRule: "Mandatory",
                copyAlsoModellingRules: true
            });
        }).not.throw();
        const operational = loader
            ?.getChildByName("FunctionSet", lads)
            ?.getChildByName("Cover")
            ?.getChildByName("Operational", lads);
        should(operational).be.ok();
        const organized = operational!.findReferencesExAsObject("Organizes", BrowseDirection.Forward).map((n) => n.browseName.name);
        should(organized.filter((name) => name === "Stop")).have.length(1);
    });
});
