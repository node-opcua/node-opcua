import "should";
import { AddressSpace, PseudoSession, UAFile } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import { fs as fsMemory } from "memfs";
import { writeFile, AbstractFs, installFileType, ClientFile, readOPCUAFile } from "..";

describe("FileTransfer with virtual file system & refreshFunc", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        const xmlFiles = [nodesets.standard];
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, xmlFiles);
        addressSpace.registerNamespace("Own");
    });
    after(() => {
        addressSpace.dispose();
    });

    let opcuaFile: UAFile;
    const buff = Buffer.from("Hello-World", "ascii");
    before(async () => {
        const namespace = addressSpace.getOwnNamespace();

        const fileType = addressSpace.findObjectType("FileType")!;

        // install file 1
        opcuaFile = fileType.instantiate({
            browseName: "FileTransferObj",
            organizedBy: addressSpace.rootFolder.objects.server
        }) as UAFile;

        const fileSystem = fsMemory as any as AbstractFs;
        const filename = "/tempFile1.txt";

        const refreshFileContentFunc = async () => {
            await writeFile(fileSystem, filename, buff);
        };
        installFileType(opcuaFile, { filename, fileSystem: fileSystem,  refreshFileContentFunc  });
    });
    it("should call refreshFileContentFunc when ever a opcua read operation is going to append", async () => {
        const session = new PseudoSession(opcuaFile.addressSpace);

        const content = await readOPCUAFile(new ClientFile(session, opcuaFile.nodeId));
        content.toString("utf-8").should.eql("Hello-World");
        
        buff[0] = "A".charCodeAt(0);
        const content1 = await readOPCUAFile(new ClientFile(session, opcuaFile.nodeId));
        content1.toString("utf-8").should.eql("Aello-World");
        
    });
});
