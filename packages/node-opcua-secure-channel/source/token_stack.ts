import { DerivedKeys } from "node-opcua-crypto/web";
import { assert } from "node-opcua-assert";
import { make_debugLog, checkDebugFlag, make_warningLog } from "node-opcua-debug";
import chalk from "chalk";
import { DerivedKeys1 } from "./security_policy";
import { DateTime } from "node-opcua-basic-types";

const debugLog = make_debugLog("TOKEN");
const doDebug = checkDebugFlag("TOKEN");
const warningLog = make_warningLog("TOKEN");

export interface ISecurityToken {
    tokenId: number;
    createdAt: DateTime;
    revisedLifetime: number;
    channelId: number;  
}

export interface SecurityTokenAndDerivedKeys {
    securityToken: ISecurityToken;
    // derivedKeys might not be defined if security mode is none
    derivedKeys: DerivedKeys1 | null;
}


 function hasTokenReallyExpired(token: ISecurityToken): boolean {
    const now = new Date();
    const age = now.getTime() - token.createdAt!.getTime();
    return age > token.revisedLifetime * 1.25;
}

export interface IDerivedKeyProvider {
    getDerivedKey(tokenId: number): DerivedKeys | null;
}
export class TokenStack {
    #tokenStack: SecurityTokenAndDerivedKeys[] = [];

    #clientKeyProvider: IDerivedKeyProvider;
    #serverKeyProvider: IDerivedKeyProvider;

    private id:number = 0;
    constructor(channelId: number){
        this.id = channelId;
        this.#clientKeyProvider = {
            getDerivedKey: (tokenId: number): DerivedKeys | null => {
                const d = this.getTokenDerivedKeys(tokenId); 
                if (!d) return null;
                return d.derivedClientKeys;
            }
        }
        this.#serverKeyProvider = {
            getDerivedKey: (tokenId: number): DerivedKeys | null => {
                const d = this.getTokenDerivedKeys(tokenId);
                if (!d) return null;
                return d.derivedServerKeys;
            }
        }
    }
    public serverKeyProvider(): IDerivedKeyProvider { return this.#serverKeyProvider; }
    public clientKeyProvider(): IDerivedKeyProvider { return this.#clientKeyProvider; }
    public pushNewToken(securityToken: ISecurityToken, derivedKeys: DerivedKeys1  | null): void {
     
        this.removeOldTokens();

        // TODO: make sure this list doesn't grow indefinitely
        const _tokenStack = this.#tokenStack;
        assert(_tokenStack.length === 0 || _tokenStack[0].securityToken.tokenId !== securityToken.tokenId);
        _tokenStack.push({
            derivedKeys,
            securityToken
        });
        /* istanbul ignore next */
        if (doDebug) {
            debugLog("id=", this.id, chalk.cyan("Pushing new token with id "), securityToken.tokenId, this.tokenIds());
        }
    }
    private tokenIds() {
        return this.#tokenStack.map((a) => a.securityToken.tokenId);
    }
    public getToken(tokenId: number): ISecurityToken | null {
        const token = this.#tokenStack.find((a) => a.securityToken.tokenId === tokenId);
        if (!token) return null;
        return token.securityToken;
    }
    public getTokenDerivedKeys(tokenId: number): DerivedKeys1 | null 
    {
        const token = this.#tokenStack.find((a)=> a.securityToken.tokenId === tokenId);
        if (!token) return null;

        if (hasTokenReallyExpired(token.securityToken)) {
            return null;
        }
        return token.derivedKeys;
    }

    public removeOldTokens() {
    
        // remove all expired tokens
        this.#tokenStack = this.#tokenStack.filter((token) => !hasTokenReallyExpired(token.securityToken));

    }
}