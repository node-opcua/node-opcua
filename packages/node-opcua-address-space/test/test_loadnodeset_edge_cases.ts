import * as should from "should";
import { nodesets } from "node-opcua-nodesets";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("Testing loadNodeSet - edge cases", async function (this: any) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("LNSEC-1 should raise a error if node set is missing - for instance ADI without DI", async () => {
        let _err: Error;
        try {
            await generateAddressSpace(addressSpace, [
                nodesets.standard,
                /* INTENTIONNALY REMOVED nodesets.di, */
                nodesets.adi
            ]);
        } catch (err) {
            _err = err;
        }
        should(_err).be.instanceOf(Error);
        should(_err.message).match(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
    });
});
