import * as should from "should";

import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";

import { displayNodeElement, setNamespaceMetaData } from "..";
import { removeDecoration } from "./test_helpers";

// tslint:disable-next-line: no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("displayNodeElement", () => {
    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn://myNamespace");
        const xmlFiles = [nodesets.standard, nodesets.di];
        await generateAddressSpace(addressSpace, xmlFiles);
    });

    after(() => {
        addressSpace.dispose();
    });

    it("should set namespace metaData1", () => {
        const namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("urn://myNamespace");
        setNamespaceMetaData(namespace);

        const str1 = displayNodeElement(addressSpace.rootFolder.objects.server.namespaces!);
        // console.log(removeDecoration(str1));
        removeDecoration(str1).should
            .eql(`┌──────────────────────┬──────────────┬───────────────────────────────────┬───────────────┬───────────────────────┬──────────┬───────┐
│ ReferenceType        │ NodeId       │ BrowseName                        │ ModellingRule │ TypeDefinition        │ DataType │ Value │
├──────────────────────┼──────────────┴───────────────────────────────────┴───────────────┴───────────────────────┴──────────┴───────┤
│ BrowseName:          │ Namespaces                                                                                                  │
├──────────────────────┼──────────────┬───────────────────────────────────┬───────────────┬───────────────────────┬──────────┬───────┤
│ HasTypeDefinition ⓄT │ ns=0;i=11645 │ NamespacesType                    │               │                       │          │       │
├──────────────────────┼──────────────┼───────────────────────────────────┼───────────────┼───────────────────────┼──────────┼───────┤
│ HasComponent Ⓞ       │ ns=0;i=15957 │ http://opcfoundation.org/UA/      │               │ NamespaceMetadataType │          │       │
├──────────────────────┼──────────────┼───────────────────────────────────┼───────────────┼───────────────────────┼──────────┼───────┤
│ HasComponent Ⓞ       │ ns=2;i=15001 │ 2:http://opcfoundation.org/UA/DI/ │               │ NamespaceMetadataType │          │       │
├──────────────────────┼──────────────┼───────────────────────────────────┼───────────────┼───────────────────────┼──────────┼───────┤
│ HasComponent Ⓞ       │ ns=1;i=1000  │ 1:urn://myNamespace               │               │ NamespaceMetadataType │          │       │
└──────────────────────┴──────────────┴───────────────────────────────────┴───────────────┴───────────────────────┴──────────┴───────┘`);
    });
});
