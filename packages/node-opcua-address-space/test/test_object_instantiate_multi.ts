import should from "should";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { nodesets } from "node-opcua-nodesets";

import { AddressSpace, getSymbols, IAddressSpace, SessionContext, setSymbols } from "..";
import { generateAddressSpace } from "../distNodeJS";

const context = SessionContext.defaultContext;

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

describe("Test object instantiate multi", () => {
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

    function getCoffeeMachineDeviceType(addressSpace: IAddressSpace) {
        const nsKitchen = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        nsKitchen.should.be.greaterThanOrEqual(0);
        const coffeeMachineDeviceType = addressSpace.findObjectType("CoffeeMachineDeviceType", nsKitchen)!;
        should.exists(coffeeMachineDeviceType);

        const deviceSet = addressSpace.findNode("ns=2;i=5001");
        if (!deviceSet) throw new Error("Cannot find device set node");

        return { deviceSet, coffeeMachineDeviceType: coffeeMachineDeviceType };
    }

    it("should be possible to instantiate 2 objects - registerSymbolicNames = false", () => {
        const { coffeeMachineDeviceType, deviceSet } = getCoffeeMachineDeviceType(addressSpace);
        const coffeeMachine1 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1", organizedBy: deviceSet });
        const coffeeMachine2 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1", organizedBy: deviceSet });
    });

    it("should be possible to instantiate 2 objects - registerSymbolicNames = true", async () => {
        const ns = addressSpace.getOwnNamespace();

        setSymbols(ns, []);

        const { coffeeMachineDeviceType, deviceSet } = getCoffeeMachineDeviceType(addressSpace);
        const coffeeMachine1 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1", organizedBy: deviceSet });
        const coffeeMachine2 = coffeeMachineDeviceType.instantiate({ browseName: "Machine2", organizedBy: deviceSet });

        const theSymbols = getSymbols(ns);
        console.log(getSymbols(ns));

        {
            const addressSpace2 = await buildAddressSpace();
            const ns2 = addressSpace.getOwnNamespace();
            const { coffeeMachineDeviceType: coffeeMachineDeviceType, deviceSet } = getCoffeeMachineDeviceType(addressSpace2);

            setSymbols(ns2, theSymbols);

            // let's buiild in  a diffiernt order !!
            const coffeeMachine2 = coffeeMachineDeviceType.instantiate({ browseName: "Machine2", organizedBy: deviceSet });

            const coffeeMachine1 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1", organizedBy: deviceSet });

            console.log(getSymbols(ns2));
            getSymbols(ns2).should.eql(theSymbols, "symbols should not be affected");

            addressSpace2.dispose();
        }
    });
});
