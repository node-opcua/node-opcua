// /**
//  * @module node-opcua-server-configuration
//  */
// import { StatusCode, StatusCodes } from "node-opcua-status-code";
// import { ITrustList } from "./trust_list";

// export class TrustList implements ITrustList {

//   public async closeAndUpdate(
//     applyChangesRequired: boolean
//   ): Promise<boolean> {

//     return false;
//   }

//   public async addCertificate(
//     certificate: Buffer,
//     isTrustedCertificate: boolean
//   ): Promise<StatusCode> {
//     return StatusCodes.BadNotImplemented;
//   }

//   public async removeCertificate(
//     thumbprint: string,
//     isTrustedCertificate: boolean
//   ): Promise<StatusCode> {
//     return StatusCodes.BadNotImplemented;
//   }
// }
