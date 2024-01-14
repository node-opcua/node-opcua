
import { OPCUAServer, DataType } from "node-opcua";


async function main() {

    const server = new OPCUAServer({
        port: 4334,
        resourcePath: "/UA/MyLittleServer",
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();


    //PipeFolderType
    const pipeFolderType = namespace.addObjectType({
        browseName: "PipeFolderType",
        subtypeOf: 'FolderType'
    });

    const propertyType = addressSpace.findNode('ns=0;i=68')

    const size = namespace.addVariable({
        browseName: "size",
        organizedBy: pipeFolderType,
        typeDefinition: propertyType,
        dataType: DataType.String,
        modellingRule: 'Mandatory',
    })

    const valve = namespace.addVariable({
        browseName: "valve",
        organizedBy: pipeFolderType,
        typeDefinition: 'BaseDataVariableType',
        dataType: DataType.Boolean,
        modellingRule: 'Mandatory',
    })

    //BoilerType
    const boilerType = namespace.addObjectType({
        browseName: "BoilerType",
    })


    const inputPipe = namespace.addObject({
        browseName: 'inputPipe',
        modellingRule: 'Mandatory',
        typeDefinition: pipeFolderType,
        componentOf: boilerType
    })

    const outputPipe = namespace.addObject({
        browseName: 'outputPipe',
        modellingRule: 'Mandatory',
        typeDefinition: pipeFolderType,
        componentOf: boilerType
    })

    const objectFolder = namespace.addFolder("ObjectsFolder", { //Folder
        browseName: "Devices"
    });

    const myboiler = boilerType.instantiate({
        browseName: "MyBoiler",
        organizedBy: objectFolder,
    });


    await server.start();
}

async function main2() {

    const server = new OPCUAServer({
        port: 4334,
        resourcePath: "/UA/MyLittleServer",
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;
    const namespace = addressSpace.getOwnNamespace();


    //PipeFolderType
    const pipeFolderType = namespace.addObjectType({
        browseName: "PipeFolderType",
        subtypeOf: 'FolderType'
    });
    console.log("A");


    const propertyType = addressSpace.findNode('ns=0;i=68')

    const size = namespace.addVariable({
        browseName: "size",
        organizedBy: pipeFolderType,
        typeDefinition: propertyType,
        dataType: DataType.String,
        modellingRule: 'Mandatory',
    })
    console.log("B");

    const valve = namespace.addVariable({
        browseName: "valve",
        organizedBy: pipeFolderType,
        typeDefinition: 'BaseDataVariableType',
        dataType: DataType.Boolean,
        modellingRule: 'Mandatory',
    })
    console.log("B");

    //BoilerType
    const boilerType = namespace.addObjectType({
        browseName: "BoilerType",
    })

    const inputPipe = pipeFolderType.instantiate({
        browseName: "inputPipe",
        modellingRule: 'Mandatory',
        organizedBy: boilerType,
    })
    console.log("C");
    const outputPipe = pipeFolderType.instantiate({
        browseName: "outputPipe",
        modellingRule: 'Mandatory',
        organizedBy: boilerType,
    })
    console.log("D");

    const objectFolder = namespace.addFolder("ObjectsFolder", { //Folder
        browseName: "Devices"
    });
    console.log("E");

    const myboiler = boilerType.instantiate({
         browseName: "MyBoiler",
         organizedBy: objectFolder,
    });
    console.log("F");


    await server.start();
    console.log("s", server.getEndpointUrl());
}
main2();


