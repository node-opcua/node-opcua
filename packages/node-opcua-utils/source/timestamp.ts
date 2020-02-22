function w(s: string | number, length: number): string {
    return ("000" + s).substr(-length);
}

function t(d: Date): string {
    return w(d.getUTCHours(), 2) + ":"
        + w(d.getUTCMinutes(), 2) + ":"
        + w(d.getUTCSeconds(), 2) + ":"
        + w(d.getMilliseconds(), 3);
}

export function timestamp() {
    return t(new Date());
}

