import {
    type ClientSession,
    MessageSecurityMode,
    OPCUAClient,
    SecurityPolicy,
    UserTokenType,
    type UserIdentityInfo
} from "node-opcua-client";
import { SAMPLE_USERS } from "../bin/sample_server_with_aliases.js";

/** Anonymous identity, the default for these tests. */
export const ANONYMOUS: UserIdentityInfo = { type: UserTokenType.Anonymous };

/** Sign in as one of the sample users. */
export function asUser(user: keyof typeof SAMPLE_USERS): UserIdentityInfo {
    return {
        type: UserTokenType.UserName,
        userName: SAMPLE_USERS[user].userName,
        password: SAMPLE_USERS[user].password
    };
}

/**
 * Connect a real `OPCUAClient` over TCP, run `fn` with the session, and always
 * close both.
 *
 * Everything here goes over a real transport on purpose: encoding, chunking and
 * session lifetime are exactly what an in-process `PseudoSession` cannot show.
 */
export async function withSession<T>(
    endpointUrl: string,
    identity: UserIdentityInfo,
    fn: (session: ClientSession, client: OPCUAClient) => Promise<T>
): Promise<T> {
    const client = OPCUAClient.create({
        endpointMustExist: false,
        securityMode: MessageSecurityMode.None,
        securityPolicy: SecurityPolicy.None,
        connectionStrategy: { maxRetry: 1, initialDelay: 100, maxDelay: 500 }
    });
    await client.connect(endpointUrl);
    try {
        const session = await client.createSession(identity);
        try {
            return await fn(session, client);
        } finally {
            await session.close();
        }
    } finally {
        await client.disconnect();
    }
}
