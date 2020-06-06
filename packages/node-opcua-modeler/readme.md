## Node-OPCUA Modeler

Node-opcua-modeler provides a programatic way to conveniently create OPCUA model and nodeset files.

```typescript
import {
    AddressSpace,
    buildModel,
    nodesets
} from "node-opcua-modeler";
import * as fs from "fs";

// the namespaceUri
const namespaceUri = "http://acme.com/Boiler/V0";
const version= "1.0.0";

// the nodeset file required by your model
const xmlFiles: string[] = [
    nodesets.standard,
    nodesets.di
];
    
async function createModel(addressSpace: AddressSpace): Promise<void> {
    // create your model here !
}

(async () => {
    try {
        const { markdown, xmlModel, symbols } = await buildModel({
            namespaceUri,
            version,
            xmlFiles,
            createModel
        });
        // save model to a file
        const nodesetFiename = "./MyModel.NodeSet2.xml";
        await fs.promises.writeFile(nodesetFiename, xmlModel, "utf-8");

    } catch (err) {
        console.log("Error", err);
    }
})();
```
