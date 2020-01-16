## Node-OPCUA Modeler

Node-opcua-modeler provides a programatic way to conveniently create OPCUA model and nodeset files.

```typescript
import {
    AddressSpace,
    buildModel,
    nodesets
} from "node-opcua-modeler";


// the namespaceUri
const namespaceUri = "http://acme.com/Boiler/V0";
const version= "1.0.0";

// the nodeset file required by your model
const xmlFiles = {
    nodesets.standard,
    nodesets.di
};

function createModel(addressSpace: AddressSpace): void {
    // create your model here !
}

(async () => {
    try {
        const xmlModel = await buildModel({
            namespaceUri,
            version,
            xmlFiles,
            createModel
        });
        // save model to a file
        const nodesetFiename = "./MyModel.NodeSet2.xml";
        await fs.promises.writeFile(nodesetFiename, xml, "utf-8");

    } catch (err) {
        console.log("Error", err);
    }
})();
```
