// ----- this file has been automatically generated - do not edit
import { UAProcessWorkingUnit, UAProcessWorkingUnit_Base } from "./ua_process_working_unit"
import { UAFormingPositions } from "./ua_forming_positions"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/MetalForming/                   |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |FormingProcessWorkingUnitType i=1008                        |
 * |isAbstract      |false                                                       |
 */
export interface UAFormingProcessWorkingUnit_Base extends UAProcessWorkingUnit_Base {
    formingPositions: UAFormingPositions;
}
export interface UAFormingProcessWorkingUnit extends UAProcessWorkingUnit, UAFormingProcessWorkingUnit_Base {
}