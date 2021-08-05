import { populateDataTypeManager, getExtraDataTypeManager} from "node-opcua-client-dynamic-extension-object";
import { IBasicSession } from "node-opcua-pseudo-session";

export async function parse_opcua_common(session: IBasicSession) {
    const dataTypeManager= await getExtraDataTypeManager(session);
    await populateDataTypeManager(session, dataTypeManager, true);
}
