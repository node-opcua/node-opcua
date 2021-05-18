import { Namespace, PseudoSession } from "..";
import { AddressSpace,  } from "..";
import { generateAddressSpace } from "../nodeJS";
import * as path from "path";
import { resolveNodeId , coerceNodeId} from "node-opcua-nodeid";

import { getBuiltInDataType } from "node-opcua-pseudo-session";
import {promisify} from "util";
import { DataType } from "node-opcua-variant";
import { nodesets } from "node-opcua-nodesets";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing github issue #998", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    before(async () => {
        addressSpace = AddressSpace.create();
        namespace = addressSpace.registerNamespace("private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);

        const dataType = namespace.createDataType({
            browseName: "MyDatType",
            isAbstract: false,
            nodeId: "s=MyDataData",
            subtypeOf: resolveNodeId("Double")
        })
        const variable = namespace.addVariable({
            browseName: "MyVar",
            dataType,
            nodeId: "s=MyVar"
        })
    });
    after(async () => {
        addressSpace.dispose();
    });

    it("getBuiltInDataType should succeed when dataType is not numeric",async () => {

        const session = new PseudoSession(addressSpace);
        
        const t: DataType = await promisify(getBuiltInDataType)(session, coerceNodeId("ns=1;s=MyVar"));

        console.log(DataType[t]);

    });

});
