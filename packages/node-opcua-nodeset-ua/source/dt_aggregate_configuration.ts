// ----- this file has been automatically generated - do not edit
import { Byte } from "node-opcua-basic-types"
import { DTStructure } from "./dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/                      |
 * | nodeClass |DataType                                          |
 * | name      |AggregateConfiguration                            |
 * | isAbstract|false                                             |
 */
export interface DTAggregateConfiguration extends DTStructure  {
  useServerCapabilitiesDefaults: boolean; // Boolean ns=0;i=1
  treatUncertainAsBad: boolean; // Boolean ns=0;i=1
  percentDataBad: Byte; // Byte ns=0;i=3
  percentDataGood: Byte; // Byte ns=0;i=3
  useSlopedExtrapolation: boolean; // Boolean ns=0;i=1
}