import { BinaryStream } from "node-opcua-binary-stream";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { decodeVariant, encodeVariant } from "node-opcua-variant";
import should from "should";
import type { UAVariable } from "..";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../nodeJS.js";
import { getAddressSpaceFixture } from "../test_helpers/get_address_space_fixture.js";

describe("Testing loadNodeSet - edge cases", async function (this: Mocha.Suite) {
    this.timeout(200000); // could be slow on appveyor !

    let addressSpace: AddressSpace;
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("LNSEC-1 should raise a error if node set is missing - for instance ADI without DI", async () => {
        let _err: Error | undefined;
        try {
            await generateAddressSpace(addressSpace, [
                nodesets.standard,
                /* INTENTIONNALY REMOVED nodesets.di, */
                nodesets.adi
            ]);
        } catch (err) {
            _err = err as Error;
        }
        should(_err!).be.instanceOf(Error);
        should(_err?.message).match(/Cannot find namespace for http:\/\/opcfoundation.org\/UA\/DI\//);
    });

    it("LNSEC-2 should load a nodeset containing special encoded characters such as ö ë ñ ü", async () => {
        const nodeset_with_special_characters = getAddressSpaceFixture("nodeset_with_utf8_special_characters.xml");

        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset_with_special_characters]);

        const o1 = addressSpace.findNode("ns=1;i=1001")!;
        should(o1.browseName.name).eql("Noël");

        const o2 = addressSpace.findNode("ns=1;i=1002")!;
        should(o2.browseName.name).eql("Strauß");

        const o3 = addressSpace.findNode("ns=1;i=1003")!;
        should(o3.browseName.name).eql("Bjørn Ødger Åse");

        const o4 = addressSpace.findNode("ns=1;i=1004")!;
        should(o4.browseName.name).eql("Günter Альберт");

        const o5 = addressSpace.findNode("ns=1;i=1005")!;
        should(o5.browseName.name).eql("Мир во всём ми́ре");

        const o6 = addressSpace.findNode("ns=1;i=1006")!;
        should(o6.browseName.name).eql("صلح در زمین");
    });

    it("LNSEC-3 -  should load a nodeset2.xml that has no Aliases section", async () => {
        const nodeset = getAddressSpaceFixture("nodeset_no_aliases.xml");

        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset]);
    });
    it("LNSEC-4 -  should load a nodeset2.xml that has no Aliases section", async () => {
        const nodeset = getAddressSpaceFixture("nodeset_no_aliases_with_aliases.xml");

        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset]);
    });

    it("LNSEC-5 -  should load a nodeset2.xml  has Maxtrix variable with missing values", async () => {
        const nodeset = getAddressSpaceFixture("nodeset_with_matrix_variable_and_missing_values.xml");

        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset]);
    });

    it("LNSEC-5b -  a Matrix variable loaded with no <Value> must encode to a spec-consistent (decodable) Variant", async () => {
        // see customer report (Mika Karaila / AO21): a Matrix UAVariable declared with fixed
        // ArrayDimensions but no <Value> in the nodeset is loaded with value=[] and the *declared*
        // dimensions. When read and serialized on the wire, encodeVariant() emits
        //   encodingByte 0xcc | ArraySize 0 | ArrayDimensions [11,1]
        // which violates the OPC UA spec (ArrayLength must equal product(dimensions)). node-opcua's
        // own decoder rejects it with "inconsistent matrix", and strict clients stall on it.
        const nodeset = getAddressSpaceFixture("nodeset_with_matrix_variable_and_missing_values.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodeset]);

        const uaVariable = addressSpace.findNode("ns=1;i=1250") as UAVariable;
        should.exist(uaVariable, "expected the matrix variable ns=1;i=1250 to be loaded");

        const dataValue = uaVariable.readValue();
        const variant = dataValue.value;

        // loader fix: an uninitialized matrix (no <Value> for fixed dimensions) must not advertise Good
        dataValue.statusCode.should.eql(StatusCodes.BadWaitingForInitialData);

        // encoder fix: the value actually put on the wire must be self-consistent: re-decoding the
        // encoded Variant must succeed. Before the fix this threw "inconsistent matrix".
        const stream = new BinaryStream(4096);
        encodeVariant(variant, stream);
        const buffer = stream.buffer.subarray(0, stream.length);

        (function roundTrip() {
            const v2 = decodeVariant(new BinaryStream(buffer));
            should.exist(v2);
        }).should.not.throw();
    });
    it("LNSEC-6-  should load a nodeset2.xml  with recursive DataType", async () => {
        const nodeset = getAddressSpaceFixture("datatype_recursive.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, /* makesure not in second position*/ nodeset]);
    });
    it("LNSEC-7-  should load a nodeset2.xml  with recursive DataType", async () => {
        const nodeset2 = getAddressSpaceFixture("datatype_recursive2.xml");
        const nodeset1 = getAddressSpaceFixture("datatype_recursive.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di, nodeset1, nodeset2]);
    });
});
