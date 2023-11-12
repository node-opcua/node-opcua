import path from "path";
import fs from "fs";
import "should";
import { nodesets } from "node-opcua-nodesets";
import {
    AddressSpace,
    IAddressSpace,
    constructNamespaceDependency,
    constructNamespacePriorityTable,
    _constructNamespaceTranslationTable,
    _recomputeRequiredModelsFromTypes,
    _recomputeRequiredModelsFromTypes2
} from "..";
import { generateAddressSpace } from "../nodeJS";
import { makeBoiler } from "../testHelpers";

const tmpFolder = path.join(__dirname, "../tmp");

function getCoffeeMachineDeviceType(addressSpace: IAddressSpace) {
    const nsKitchen = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
    if (nsKitchen == -1) {
        throw new Error("cannot find kitchen namespace");
    }
    const coffeeMachineDeviceType = addressSpace.findObjectType("CoffeeMachineDeviceType", nsKitchen)!;

    const deviceSet = addressSpace.findNode("ns=2;i=5001");
    if (!deviceSet) throw new Error("Cannot find device set node");

    return { deviceSet, coffeeMachineDeviceType: coffeeMachineDeviceType };
}

export function installBoilerStuff(addressSpace: AddressSpace) {
    const namespace = addressSpace.getOwnNamespace();
    // createBoilerType(namespace);
    makeBoiler(addressSpace, {
        browseName: "Boiler#1",
        organizedBy: addressSpace.rootFolder.objects
    });
    makeBoiler(addressSpace, {
        browseName: "Boiler#2",
        organizedBy: addressSpace.rootFolder.objects
    });
}
function installCoffeeMachineStuff(addressSpace: AddressSpace) {
    const { coffeeMachineDeviceType, deviceSet } = getCoffeeMachineDeviceType(addressSpace);
    const coffeeMachine1 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1" });
    // add organized afterward on purpose, to ensure the reference linking DeviceSet to CoffeeMachine1
    // belongs to DeviceSet and not CoffeeMachine
    deviceSet.addReference({
        referenceType: "Organizes",
        nodeId: coffeeMachine1.nodeId
    });
    // use a conventional link here
    const coffeeMachine2 = coffeeMachineDeviceType.instantiate({ browseName: "Machine1" });
    coffeeMachine2.addReference({
        referenceType: "Organizes",
        isForward: false,
        nodeId: deviceSet.nodeId
    });
}

const exportedNamespace = async (addressSpace: IAddressSpace) => {
    const namespaces: string[] = [nodesets.standard];
    if (!fs.existsSync(tmpFolder)) {
        fs.mkdirSync(tmpFolder);
    }
    for (const namespace of addressSpace.getNamespaceArray()) {
        if (namespace.index === 0) {
            continue;
        }
        const file = path.join(
            tmpFolder,
            "tmp" +
                namespace.namespaceUri
                    .replace(/\/+/g, "_")
                    .replace(/[a-z]+:/, "")
                    .replace(/^_/m, "")
                    .replace(/\./g, "_")
        );
        console.log("writing ", file);
        const xml = namespace.toNodeset2XML();
        fs.writeFileSync(file, xml, "utf-8");
        namespaces.push(file);
    }
    return namespaces;
};
describe("constructNamespaceDependency", function () {
    this.timeout(100000);

    const buildAddressSpace = async (xmlFiles: string[]) => {
        const addressSpace = AddressSpace.create();

        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, xmlFiles);

        installCoffeeMachineStuff(addressSpace);
        installBoilerStuff(addressSpace);
        for (const namespace of addressSpace.getNamespaceArray()) {
            const { requiredNamespaceIndexes, nbTypes } = _recomputeRequiredModelsFromTypes(namespace);
            console.log(namespace.index, namespace.namespaceUri.padEnd(55, ".") + ":", { requiredNamespaceIndexes, nbTypes });
        }
        return addressSpace;
    };

    let addressSpace: IAddressSpace;
    before(async () => {
        const xmlFiles = [nodesets.standard, nodesets.di, nodesets.adi, nodesets.commercialKitchenEquipment];
        addressSpace = await buildAddressSpace(xmlFiles);
    });
    after(async () => {
        await addressSpace.shutdown();
        addressSpace.dispose();
    });
    it("RRR-1 testing _recomputeRequiredModelsFromTypes", async () => {
        const cache = new Map();
        addressSpace.getNamespace(0).namespaceUri.should.eql("http://opcfoundation.org/UA/");
        _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(0), cache).requiredNamespaceIndexes.should.eql([]);
        _recomputeRequiredModelsFromTypes2(addressSpace.getNamespace(0), cache).requiredNamespaceIndexes.should.eql([]);

        addressSpace.getNamespace(1).namespaceUri.should.eql("Private");
        _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(1), cache).requiredNamespaceIndexes.should.eql([0, 4]);
        _recomputeRequiredModelsFromTypes2(addressSpace.getNamespace(1), cache).requiredNamespaceIndexes.should.eql([0, 2, 4]);

        addressSpace.getNamespace(2).namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
        _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(2), cache).requiredNamespaceIndexes.should.eql([0]);
        _recomputeRequiredModelsFromTypes2(addressSpace.getNamespace(2), cache).requiredNamespaceIndexes.should.eql([0]);

        addressSpace.getNamespace(3).namespaceUri.should.eql("http://opcfoundation.org/UA/ADI/");
        _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(3), cache).requiredNamespaceIndexes.should.eql([0, 2]);
        _recomputeRequiredModelsFromTypes2(addressSpace.getNamespace(3), cache).requiredNamespaceIndexes.should.eql([0, 2]);

        addressSpace.getNamespace(4).namespaceUri.should.eql("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        _recomputeRequiredModelsFromTypes(addressSpace.getNamespace(4), cache).requiredNamespaceIndexes.should.eql([0, 2]);
        _recomputeRequiredModelsFromTypes2(addressSpace.getNamespace(4), cache).requiredNamespaceIndexes.should.eql([0, 2]);
    });

    it("RRR-2 testing constructNamespacePriorityTable", async () => {
        const { loadingOrder, priorityTable } = constructNamespacePriorityTable(addressSpace);
        console.log("priorityTable ", priorityTable);
        console.log("loadingOrder  ", loadingOrder);
        priorityTable.should.eql([0, 3, 1, 4, 2]);
        loadingOrder.should.eql([0, 2, 4, 1, 3]);

        addressSpace.getNamespace(loadingOrder[0]).namespaceUri.should.eql("http://opcfoundation.org/UA/");
        addressSpace.getNamespace(loadingOrder[1]).namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
        addressSpace
            .getNamespace(loadingOrder[2])
            .namespaceUri.should.eql("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        addressSpace.getNamespace(loadingOrder[3]).namespaceUri.should.eql("Private");
        addressSpace.getNamespace(loadingOrder[4]).namespaceUri.should.eql("http://opcfoundation.org/UA/ADI/");
    });

    it("RRR-3 testing constructNamespaceDependency", async () => {
        const priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;
        for (const namespace of addressSpace.getNamespaceArray()) {
            // if (namespace.index === 0) continue;
            const dependencies = constructNamespaceDependency(namespace, priorityTable);
            const translationTable = _constructNamespaceTranslationTable(dependencies, namespace);
            console.log(`${namespace.namespaceUri}(${namespace.index}) :`);
            console.log("      ", dependencies.map((x) => x.namespaceUri).join(" => "));
            console.log(" translationTa>ble = ", translationTable);
        }
    });

    it("RRR-3b checking import", async () => {
        const nsKitchen = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/CommercialKitchenEquipment/");
        if (nsKitchen == -1) {
            throw new Error("cannot find kitchen namespace");
        }
        const commercialKitchenDeviceType = addressSpace.findObjectType("CommercialKitchenDeviceType", nsKitchen)!;

        console.log(commercialKitchenDeviceType.toString());
    });
    it("RRR-4 testing reloading namespace after exports", async () => {
        
        const nodeFilenames = await exportedNamespace(addressSpace);

        const addressSpace2 = AddressSpace.create();
        await generateAddressSpace(addressSpace2, nodeFilenames, {});

        const namespaces = addressSpace2.getNamespaceArray();
        namespaces.length.should.eql(5);
        namespaces[0].namespaceUri.should.eql("http://opcfoundation.org/UA/");
        namespaces[1].namespaceUri.should.eql("Private");
        namespaces[2].namespaceUri.should.eql("http://opcfoundation.org/UA/DI/");
        namespaces[3].namespaceUri.should.eql("http://opcfoundation.org/UA/ADI/");
        namespaces[4].namespaceUri.should.eql("http://opcfoundation.org/UA/CommercialKitchenEquipment/");

        _recomputeRequiredModelsFromTypes2(addressSpace2.getNamespace(0)).requiredNamespaceIndexes.should.eql([]);
        _recomputeRequiredModelsFromTypes2(addressSpace2.getNamespace(1)).requiredNamespaceIndexes.should.eql([0, 2, 4]);
        _recomputeRequiredModelsFromTypes2(addressSpace2.getNamespace(2)).requiredNamespaceIndexes.should.eql([0]);
        _recomputeRequiredModelsFromTypes2(addressSpace2.getNamespace(3)).requiredNamespaceIndexes.should.eql([0, 2]);
        _recomputeRequiredModelsFromTypes2(addressSpace2.getNamespace(4)).requiredNamespaceIndexes.should.eql([0, 2]);
        await addressSpace2.dispose();
    });
});
