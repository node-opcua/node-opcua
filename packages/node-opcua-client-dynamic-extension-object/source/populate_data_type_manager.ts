import { IBasicSession } from "node-opcua-pseudo-session";
//
import { ExtraDataTypeManager } from "./extra_data_type_manager";
import { populateDataTypeManager103 } from "./private/populate_data_type_manager_103";
import { populateDataTypeManager104 } from "./private/populate_data_type_manager_104";

export async function populateDataTypeManager(session: IBasicSession, dataTypeManager: ExtraDataTypeManager, force: boolean ): Promise<void> {
    // old way for 1.03 and early 1.04 prototype
    await populateDataTypeManager103(session, dataTypeManager);
    // new way for 1.04 and later
    if (force) {
        await populateDataTypeManager104(session, dataTypeManager);
    }
}
