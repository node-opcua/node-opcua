/* eslint-disable @typescript-eslint/no-empty-function */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { ISocketLike } from "../source";

export class HalfComChannel extends EventEmitter implements ISocketLike{
    private _hasEnded: boolean;
    public destroyed = false;
    private _ended = false;
    private _timeoutId: NodeJS.Timeout | null = null;
    private timeout = 0;

    constructor() {
        super();
        this._hasEnded = false;
    }
    remoteAddress?: string | undefined;
    remotePort?: number | undefined;

    public write(data: string | Buffer): void {
        if (typeof data === "string") {
            data = Buffer.from(data);
        }
        assert(data instanceof Buffer, "HalfComChannel.write expecting a buffer");
        const copy = Buffer.concat([data]);
        this.emit("send_data", copy);
    }

    public onReceiveEnd(err?: Error): void {
        this.end();
    }
    public onReceiveData(data: Buffer): void {
        assert(data instanceof Buffer);
        this._triggerTimeoutTimer();
        this.emit("data", data);
    }

    private _disconnectOtherParty() {
       if (!this._hasEnded) {
            assert(!this._hasEnded, "half communication channel has already ended !");
            this._hasEnded = true;
            this.emit("ending");
        }
    }
    public end(): void {
        if (this._hasEnded) return;
         if (this._ended) return;
        this._ended = true;
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._timeoutId = null;HalfComChannel;
        this.timeout = 0;
        this._disconnectOtherParty();
        this.emit("end");
        this.destroy();
    }

    public destroy(err?: Error): void {
        if (this.destroyed) return;
        this.destroyed = true;

        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._timeoutId = null;
        this.timeout = 0;

        err && this.emit("error", err);

        // this.emit("end", err);
        this._disconnectOtherParty();
        const hasError = !!err;
        this.emit("close", hasError);
    }

    public setKeepAlive(enable?: boolean, initialDelay?: number) {
        return this;
    }
    public setNoDelay(noDelay?: boolean) {
        return this;
    }
    public setTimeout(timeout: number, callback?: () => void) {
        this.timeout = timeout;
        this._triggerTimeoutTimer();
        return this;
    }

    private _triggerTimeoutTimer() {
        if (this._timeoutId) {
            clearTimeout(this._timeoutId);
            this._timeoutId = null;
        }
        if (this.timeout > 0 && !this._hasEnded) {
            this._timeoutId = setTimeout(() => {
                this.emit("timeout");
            }, this.timeout);
        }
    }
}
