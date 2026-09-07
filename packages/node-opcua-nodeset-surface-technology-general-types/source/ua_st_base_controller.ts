import type { UAProgramStateMachine } from "node-opcua-nodeset-ua/dist/ua_program_state_machine";

import type { UASTSystemController, UASTSystemController_Base } from "./ua_st_system_controller.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/SurfaceTechnology/GeneralTypes/ |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |STBaseControllerType i=1004                                 |
 * |isAbstract      |false                                                       |
 */
export interface UASTBaseController_Base extends UASTSystemController_Base {
    shutDown?: UAProgramStateMachine;
    startUp?: UAProgramStateMachine;
}
export interface UASTBaseController extends UASTSystemController, UASTBaseController_Base {}