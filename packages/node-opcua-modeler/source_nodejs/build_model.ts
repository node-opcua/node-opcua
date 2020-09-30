import { readNodeSet2XmlFile } from "node-opcua-address-space/nodeJS";

import { buildModelInner, BuildModelOptionsBase } from "..";
import { Symbols } from "..";

export async function buildModel(data: BuildModelOptionsBase): Promise<{ markdown: string; xmlModel: string; symbols: Symbols }> {
    const option1 = {
        ...data,
        xmlLoader: readNodeSet2XmlFile
    };
    return buildModelInner(option1);
}
