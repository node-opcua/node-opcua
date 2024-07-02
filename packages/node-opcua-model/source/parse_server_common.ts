import { populateDataTypeManager, getExtraDataTypeManager, DataTypeExtractStrategy} from "node-opcua-client-dynamic-extension-object";
import { IBasicSessionAsync2 } from "node-opcua-pseudo-session";

export async function parse_opcua_common(session: IBasicSessionAsync2) {
    const dataTypeManager= await getExtraDataTypeManager(session);
    await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Auto);
}
