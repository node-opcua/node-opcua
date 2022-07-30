import * as path from "path";
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
        should(_err!).be.instanceOf(Error);
        should(_err!.message).match(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
    });

    it("LNSEC-2 should load a nodeset containing special encoded characters such as ö ë ñ ü", async () => {
        const nodeset_with_special_characters = path.join(__dirname, "../test_helpers/test_fixtures/nodeset_with_utf8_special_characters.xml");

        await generateAddressSpace(addressSpace, [
            nodesets.standard,
            nodeset_with_special_characters   
        ]);

        const o1 = addressSpace.findNode("ns=1;i=1001")!;
        o1.browseName.name!.should.eql("Noël");

        const o2 = addressSpace.findNode("ns=1;i=1002")!;
        o2.browseName.name!.should.eql("Strauß");
        
        const o3 = addressSpace.findNode("ns=1;i=1003")!;
        o3.browseName.name!.should.eql("Bjørn Ødger Åse");
        
        const o4 = addressSpace.findNode("ns=1;i=1004")!;
        o4.browseName.name!.should.eql("Günter Альберт");

        const o5 = addressSpace.findNode("ns=1;i=1005")!;
        o5.browseName.name!.should.eql("Мир во всём ми́ре");

        const o6 = addressSpace.findNode("ns=1;i=1006")!;
        o6.browseName.name!.should.eql("صلح در زمین");
        
    });


});
