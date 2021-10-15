import { _make_flag } from "./_make_flag";

export enum AccessRestrictionsFlag {
    SigningRequired = 1,
    EncryptionRequired = 2,
    SessionRequired = 4,
    ApplyRestrictionsToBrowse = 8,
    None = 0x0
}

export function makeAccessRestrictionsFlag(str: string | number | null): AccessRestrictionsFlag {
    return _make_flag(str, AccessRestrictionsFlag.None, AccessRestrictionsFlag) as AccessRestrictionsFlag;
}

export function accessRestrictionsFlagToString(flags: AccessRestrictionsFlag): string {
    const retVal = [];
    if (flags & AccessRestrictionsFlag.SigningRequired) {
        retVal.push("SigningRequired");
    }
    if (flags & AccessRestrictionsFlag.EncryptionRequired) {
        retVal.push("EncryptionRequired");
    }
    if (flags & AccessRestrictionsFlag.SessionRequired) {
        retVal.push("SessionRequired");
    }
    if (flags & AccessRestrictionsFlag.ApplyRestrictionsToBrowse) {
        retVal.push("ApplyRestrictionsToBrowse");
    }
    if (retVal.length === 0) {
        retVal.push("None");
    }
    return retVal.join(" | ");
}
