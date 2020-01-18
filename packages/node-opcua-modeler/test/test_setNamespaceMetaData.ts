
import * as should from "should";
import { removeDecoration } from "./test_helpers";

import {
    AddressSpace,
    generateAddressSpace
} from "node-opcua-address-space";
import { nodesets } from "node-opcua-nodesets";
import {
    displayNodeElement,
    setNamespaceMetaData
} from "..";


const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("displayNodeElement", () => {

    let addressSpace: AddressSpace;

    before(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn://myNamespace");
        const xmlFiles = [
            nodesets.standard,
            nodesets.di
        ]
        await generateAddressSpace(addressSpace, xmlFiles);
    });

    after(() => {
        addressSpace.dispose();
    });


    it("should set namespace metaData1", () => {

        const namespace = addressSpace.getOwnNamespace();
        namespace.namespaceUri.should.eql("urn://myNamespace");
        setNamespaceMetaData(namespace);

        const str1 = displayNodeElement(addressSpace.rootFolder.objects.server.namespaces);
        removeDecoration(str1).should.eql(`┌────────────────┬────────────────────────────────────────────────────────────────────┬───────────────────────────────────┬───────────────┬───────────────────────┬──────────┬───────┐
│ ReferenceType  │ NodeId                                                             │ BrowseName                        │ ModellingRule │ TypeDefinition        │ DataType │ Value │
├────────────────┼────────────────────────────────────────────────────────────────────┴───────────────────────────────────┴───────────────┴───────────────────────┴──────────┴───────┤
│ BrowseName:    │ Namespaces                                                                                                                                                        │
├────────────────┼────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────┤
│ Description:   │ locale=null text=Describes the namespaces supported by the server. │                                                                                              │
├────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────────────┬───────────────┬───────────────────────┬──────────┬───────┤
│ HasComponent Ⓞ │ ns=0;i=15957                                                       │ http://opcfoundation.org/UA/      │               │ NamespaceMetadataType │          │       │
├────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────────────┼───────────────┼───────────────────────┼──────────┼───────┤
│ HasComponent Ⓞ │ ns=2;i=15001                                                       │ 2:http://opcfoundation.org/UA/DI/ │               │ NamespaceMetadataType │          │       │
├────────────────┼────────────────────────────────────────────────────────────────────┼───────────────────────────────────┼───────────────┼───────────────────────┼──────────┼───────┤
│ HasComponent Ⓞ │ ns=1;i=1000                                                        │ 1:urn://myNamespace               │               │ NamespaceMetadataType │          │       │
└────────────────┴────────────────────────────────────────────────────────────────────┴───────────────────────────────────┴───────────────┴───────────────────────┴──────────┴───────┘`);
    });
});