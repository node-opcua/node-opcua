import fs from 'fs';
import { OPCUAServer, nodesets, Variant, DataType, StatusCodes } from 'node-opcua';

(async () => {

    const data = await fetch("https://raw.githubusercontent.com/OPCFoundation/UA-Nodeset/2f76ebcfa097cde42414bea08abf04423f30ea4e/PlasticsRubber/GeneralTypes/1.03/Opc.Ua.PlasticsRubber.GeneralTypes.NodeSet2.xml");

    const filename = "./Opc.Ua.PlasticsRubber.GeneralTypes.NodeSet2.xml";
    fs.writeFileSync(filename, await data.text());

    const server = new OPCUAServer({
        nodeset_filename: [
            nodesets.standard,
            nodesets.di,
            filename
        ]
    });

    await server.initialize();

    const addressSpace = server.engine.addressSpace;

    const ns = addressSpace.getNamespaceIndex("http://opcfoundation.org/UA/PlasticsRubber/GeneralTypes/");
    if (ns === -1) {
        throw new Error("Cannot find namespace");
    }

    const activeErrorDataType = addressSpace.findDataType("ActiveErrorDataType", ns);
    if (!activeErrorDataType) {
        throw new Error("Cannot find ActiveErrorDataType");
    }

    const activeError = addressSpace.constructExtensionObject(
        activeErrorDataType,
        {
            id: "Alarm", severity: 1, message: "abc"
        });
    console.log(activeError.toString());


    const node = addressSpace.getOwnNamespace().addVariable({
        browseName: "MyVariable",
        dataType: activeErrorDataType,
        componentOf: addressSpace.rootFolder.objects.server.vendorServerInfo
    });

    node.bindVariable({
        get: () => {
            return new Variant({
                dataType: DataType.ExtensionObject,
                value: activeError,
                statusCode: StatusCodes.Good
            });
        }
    });


    await server.start();

})();

