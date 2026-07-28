import { nodesets } from "node-opcua-modeler";
// buildModel is the nodejs flavour of buildModelInner: it already provides the
// readNodeSet2XmlFile xmlLoader, so the nodeset xml files are read from disk
import { buildModel } from "node-opcua-modeler/nodeJS.js";
import { downloadTMCNodesetIfNeeded } from "./tmc-nodeset.mjs";

const tmcNodesetFilename = await downloadTMCNodesetIfNeeded();

const XML_FILES = [
  nodesets.standard,
  nodesets.di,
  nodesets.packML,
  tmcNodesetFilename,
];

const { xmlModel, symbols, markdown } = await buildModel({
  namespaceUri: "namespace",
  version: "2.0.1",
  xmlFiles: XML_FILES,
  presetSymbols: [],
  createModel: async (addressSpace) => {
    const ns = addressSpace.getOwnNamespace();
    ns.addObject({
      browseName: "line A",
      typeDefinition: "FolderType",
      organizedBy: addressSpace.rootFolder.objects,
    });
  },
});

console.log(`model built: ${xmlModel.length} bytes of xml, ${symbols.length} symbols, ${markdown.length} bytes of markdown`);
