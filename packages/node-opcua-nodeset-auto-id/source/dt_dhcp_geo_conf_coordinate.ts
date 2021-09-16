// ----- this file has been automatically generated - do not edit
import { Int32, Int16, Byte } from "node-opcua-basic-types"
import { DTStructure } from "node-opcua-nodeset-ua/source/dt_structure"
/**
 * |           |                                                  |
 * |-----------|--------------------------------------------------|
 * | namespace |http://opcfoundation.org/UA/AutoID/               |
 * | nodeClass |DataType                                          |
 * | name      |3:DhcpGeoConfCoordinate                           |
 * | isAbstract|false                                             |
 */
export interface DTDhcpGeoConfCoordinate extends DTStructure  {
  laRes: Byte; // Byte ns=0;i=3
  latitudeInteger: Int16; // Int16 ns=0;i=4
  latitudeFraction: Int32; // Int32 ns=0;i=6
  loRes: Byte; // Byte ns=0;i=3
  longitudeInteger: Int16; // Int16 ns=0;i=4
  longitudeFraction: Int32; // Int32 ns=0;i=6
  AT: Byte; // Byte ns=0;i=3
  altRes: Byte; // Byte ns=0;i=3
  altitudeInteger: Int32; // Int32 ns=0;i=6
  altitudeFraction: Int16; // Int16 ns=0;i=4
  datum: Byte; // Byte ns=0;i=3
}