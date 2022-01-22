/**
 * @module node-opcua-utils
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import { get_clock_tick } from "./get_clock_tick";

type ArbitraryClockTick = number; // in millisecond
type DurationInMillisecond = number;


export interface IWatchdogData2 {
    key: number;
    subscriber: ISubscriber;
    timeout: DurationInMillisecond;
    lastSeen: ArbitraryClockTick;
    visitCount: number;
}

export interface ISubscriber {
    _watchDog?: WatchDog;
    _watchDogData?: IWatchdogData2;

    watchdogReset: () => void;
    keepAlive?: () => void;
    onClientSeen?: () => void;
}

function hasExpired(watchDogData: IWatchdogData2, currentTime: ArbitraryClockTick) {
    const elapsedTime = currentTime - watchDogData.lastSeen;
    return elapsedTime > watchDogData.timeout;
}

function keepAliveFunc(this: ISubscriber) {
    assert(this._watchDog instanceof WatchDog);
    // istanbul ignore next
    if (!this._watchDogData || !this._watchDog) {
        throw new Error("Internal error");
    }
    assert(typeof this._watchDogData.key === "number");
    this._watchDogData.lastSeen = this._watchDog.getCurrentSystemTick();
    if (this.onClientSeen) {
        this.onClientSeen();
    }
}

export class WatchDog extends EventEmitter {
    static lastSeenToDuration(lastSeen: number): number {
        return get_clock_tick() - lastSeen;
    }

    static emptyKeepAlive = (): void => {
        /* */
    };
    /**
     * returns the number of subscribers using the WatchDog object.
     */
    get subscriberCount(): number {
        return Object.keys(this._watchdogDataMap).length;
    }

    private readonly _watchdogDataMap: { [id: number]: IWatchdogData2 };
    private _counter: number;
    private _currentTime: ArbitraryClockTick;
    private _timer: NodeJS.Timer | null;
    private readonly _visitSubscriberB: (...args: any[]) => void;

    constructor() {
        super();

        this._watchdogDataMap = {};
        this._counter = 0;
        this._currentTime = this.getCurrentSystemTick();
        this._visitSubscriberB = this._visit_subscriber.bind(this);
        this._timer = null; // as NodeJS.Timer;
    }

    /**
     * add a subscriber to the WatchDog.
     * @method addSubscriber
     *
     * add a subscriber to the WatchDog.
     *
     * This method modifies the subscriber be adding a
     * new method to it called 'keepAlive'
     * The subscriber must also provide a "watchdogReset". watchdogReset will be called
     * if the subscriber failed to call keepAlive withing the timeout period.
     * @param subscriber
     * @param timeout
     * @return the numerical key associated with this subscriber
     */
    public addSubscriber(subscriber: ISubscriber, timeout: number): number {
        this._currentTime = this.getCurrentSystemTick();
        timeout = timeout || 1000;
        assert(typeof timeout === "number", " invalid timeout ");
        assert(typeof subscriber.watchdogReset === "function", " the subscriber must provide a watchdogReset method ");
        assert(typeof subscriber.keepAlive !== "function" || subscriber.keepAlive === WatchDog.emptyKeepAlive);

        this._counter += 1;
        const key = this._counter;

        subscriber._watchDog = this;
        subscriber._watchDogData = {
            key,
            lastSeen: this._currentTime,
            subscriber,
            timeout,
            visitCount: 0
        } as IWatchdogData2;

        this._watchdogDataMap[key] = subscriber._watchDogData;

        if (subscriber.onClientSeen) {
            subscriber.onClientSeen();
        }

        subscriber.keepAlive = keepAliveFunc.bind(subscriber);

        // start timer when the first subscriber comes in
        if (this.subscriberCount === 1) {
            assert(this._timer === null);
            this._start_timer();
        }
        assert(this._timer !== null);
        return key;
    }

    public removeSubscriber(subscriber: ISubscriber): void {
        if (!subscriber._watchDog) {
            return; // already removed !!!
        }
        if (!subscriber._watchDogData) {
            throw new Error("Internal error");
        }

        assert(subscriber._watchDog instanceof WatchDog);
        assert(typeof subscriber._watchDogData.key === "number");
        assert(typeof subscriber.keepAlive === "function");
        assert(Object.prototype.hasOwnProperty.call(this._watchdogDataMap, subscriber._watchDogData.key));

        delete this._watchdogDataMap[subscriber._watchDogData.key];
        delete subscriber._watchDog;
        // leave it as it might be usefull, delete subscriber._watchDogData;
        subscriber.keepAlive = WatchDog.emptyKeepAlive;

        // delete timer when the last subscriber comes out
        if (this.subscriberCount === 0) {
            this._stop_timer();
        }
    }

    public shutdown(): void {
        assert(this._timer === null && Object.keys(this._watchdogDataMap).length === 0, " leaking subscriber in watchdog");
    }

    public getCurrentSystemTick(): ArbitraryClockTick {
        return get_clock_tick();
    }

    private _visit_subscriber() {
        this._currentTime = this.getCurrentSystemTick();

        const expiredSubscribers = Object.values(this._watchdogDataMap).filter((watchDogData: IWatchdogData2) => {
            watchDogData.visitCount += 1;
            return hasExpired(watchDogData, this._currentTime);
        });

        if (expiredSubscribers.length) {
            this.emit("timeout", expiredSubscribers);
        }
        expiredSubscribers.forEach((watchDogData: IWatchdogData2) => {
            this.removeSubscriber(watchDogData.subscriber);
            watchDogData.subscriber.watchdogReset();
        });
    }

    private _start_timer(): void {
        assert(this._timer === null, " setInterval already called ?");
        this._timer = setInterval(this._visitSubscriberB, 1000);
    }

    private _stop_timer(): void {
        assert(this._timer !== null, "_stop_timer already called ?");
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}
