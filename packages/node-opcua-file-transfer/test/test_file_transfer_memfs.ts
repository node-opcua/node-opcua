import * as os from "os";
import * as path from "path";
import * as should from "should";
import { promisify } from "util";
import { fs as MemFs}  from 'memfs';

import { AddressSpace, PseudoSession, SessionContext, UAFileType, UAMethod } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { UInt64, extraStatusCodeBits, coerceUInt64 } from "node-opcua-basic-types";
import { nodesets } from "node-opcua-nodesets";

import { AbstractFs, ClientFile, FileTypeData, getFileData, installFileType, OpenFileMode } from "..";
import { MethodIds } from "node-opcua-client";




describe("FileTransfer with virtual file system", ()=>{

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


    let opcuaFile: UAFileType;
    let opcuaFile2: UAFileType;

    it("should ", async ()=>{

    })
});
