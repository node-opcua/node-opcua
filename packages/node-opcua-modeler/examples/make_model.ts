// tslint:disable:no-console
import * as fs from "fs";
import { promisify } from "util";
import {
    AddressSpace,
    buildModel,
    createBoilerType,
    DataType,
    displayNodeElement,
    generateAddressSpace,
    getPresetSymbolsFromCSV,
    nodesets,
    promoteToMandatory,
    saveSymbolsToCSV,
    setNamespaceMetaData,
    Symbols,
    UAObject,
    UAVariable,
    UAVariableT,
} from "..";
// } from "node-opcua-modeler";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

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
const symbolFilename = "./MyModelIds.csv";

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

    const boilerDeviceType = ns.addObjectType({
        browseName: "BoilerDeviceType",
        subtypeOf: deviceType,
    });

    promoteToMandatory(boilerDeviceType, "Manufacturer", nsDI);
    promoteToMandatory(boilerDeviceType, "DeviceHealth", nsDI);
    const parameterSet = promoteToMandatory(boilerDeviceType, "ParameterSet", nsDI);

    ns.addVariable({
        browseName: "HumiditySetpoint",
        componentOf: parameterSet,
        dataType: "Double"
    });

    ns.addVariable({
        browseName: "TemperatureSetpoint",
        componentOf: parameterSet,
        dataType: "Double"
    });

    createBoilerType(ns);

    console.log((boilerDeviceType));
}

async function buildModelFile() {
    try {

        const presetSymbols = await getPresetSymbolsFromCSV(symbolFilename);

        const { xmlModel, symbols } = await buildModel({
            createModel,
            namespaceUri,
            version,
            xmlFiles,
            // tslint:disable-next-line: object-literal-sort-keys
            presetSymbols,
        });
        // save model to a file
        await writeFile(nodesetFilename, xmlModel, "utf-8");

        await saveSymbolsToCSV(symbolFilename, symbols);

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
    const boilerDeviceType = addressSpace.findObjectType("BoilerDeviceType", nsLRA);
    if (!boilerDeviceType) {
        throw new Error("cannot find boiler type");
    }

    const boiler = boilerDeviceType.instantiate({
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
