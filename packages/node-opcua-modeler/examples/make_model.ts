// tslint:disable:no-console
import * as fs from "fs";
import { promisify } from "util";
import {
    AddressSpace,
    buildModel,
    DataType,
    displayNodeElement,
    generateAddressSpace,
    nodesets,
    promoteToMandatory,
    setNamespaceMetaData,
    UAObject,
    UAVariable,
    UAVariableT,
} from "..";
// } from "node-opcua-modeler";

const writeFile  = promisify(fs.writeFile);

interface UABoilerTest extends UAObject {
    deviceHealth: UAVariable;
    manufacturer: UAVariableT<string, DataType.String>;
}

const xmlFiles = [
    nodesets.standard,
    nodesets.di
];

const namespaceUri = "http://acme.com/Boiler/V0";
const version = "1.0.0";

const nodesetFilename = "./MyModel.NodeSet2.xml";

function createModel(addressSpace: AddressSpace) {

    const ns = addressSpace.getOwnNamespace();

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (nsDI < 0) {
        throw new Error("Cannot find DI namespace!");
    }

    const deviceSet = addressSpace.rootFolder.objects.getFolderElementByName(`DeviceSet`);
    if (!deviceSet) {
        throw new Error("Cannot find DeviceSet object!");
    }

    const deviceType = addressSpace.findObjectType("DeviceType", nsDI);
    if (!deviceType) {
        throw new Error("Cannot find DevieType");
    }

    // construct namespace meta data
    const metaData = setNamespaceMetaData(addressSpace.getOwnNamespace());

    const boilerType = ns.addObjectType({
        browseName: "BoilerType",
        subtypeOf: deviceType,
    });

    promoteToMandatory(boilerType, "Manufacturer", nsDI);
    promoteToMandatory(boilerType, "DeviceHealth", nsDI);

    console.log(displayNodeElement(boilerType));
}

async function buildModelFile() {
    try {
        const xmlModel = await buildModel({
            createModel,
            namespaceUri,
            version,
            xmlFiles,
        });
        // save model to a file
        await writeFile(nodesetFilename, xmlModel, "utf-8");

    } catch (err) {
        console.log("Error", err);
    }
}

async function testNamepsace() {

    const addressSpace = AddressSpace.create();
    const xmlFiles1 = [
        nodesets.standard,
        nodesets.di,
        nodesetFilename,
    ];
    await generateAddressSpace(addressSpace, xmlFiles1);

    const nsDI = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/DI/");
    if (nsDI < 0) {
        throw new Error("Cannot find DI namespace!");
    }

    const deviceSet = addressSpace.rootFolder.objects.getFolderElementByName(`DeviceSet`);
    if (!deviceSet) {
        throw new Error("Cannot find DeviceSet object!");
    }

    const nsLRA = addressSpace.getNamespaceIndex("http://acme.com/Boiler/V0");
    const boilerType = addressSpace.findObjectType("BoilerType", nsLRA);
    if (!boilerType) {
        throw new Error("cannot find boiler type");
    }

    const boiler = boilerType.instantiate({
        browseName: "Boiler1",
        organizedBy: deviceSet
    }) as UABoilerTest;

    boiler.deviceHealth.writeEnumValue("MAINTENANCE_REQUIRED");
    boiler.manufacturer.setValueFromSource({ dataType: DataType.LocalizedText, value: { text: "STERFIVE" } });
    displayNodeElement(boiler);

    addressSpace.dispose();
}

(async () => {
    try {
        await buildModelFile();
        // now test the nodeset
        await testNamepsace();
    } catch (err) {
        console.log("err", err.message);
        console.log(err);
    }
    console.log("done");
})();
