/**
 * @module node-opcua-utils
 */
import { EventEmitter } from "events";
import { assert } from "node-opcua-assert";
import * as _ from "underscore";

export interface IWatchdogData2 {
    key: number;
    subscriber: ISubscriber;
    timeout: number;
    lastSeen: number;
    visitCount: number;
}

export interface ISubscriber {

    _watchDog?: WatchDog;
    _watchDogData?: IWatchdogData2;

    watchdogReset: () => void;
    keepAlive?: () => void;
    onClientSeen?: (t: Date) => void;
}

function has_expired(watchDogData: IWatchdogData2, currentTime: number) {
    const elapsedTime = currentTime - watchDogData.lastSeen;
    return elapsedTime > watchDogData.timeout;
}

function keepAliveFunc(this: ISubscriber) {
    const self: ISubscriber = this as ISubscriber;
    assert(self._watchDog instanceof WatchDog);
    if (!self._watchDogData) {
        throw new Error("Internal error");
    }

    assert(_.isNumber(self._watchDogData.key));
    self._watchDogData.lastSeen = Date.now();
    if (self.onClientSeen) {
        self.onClientSeen(new Date(self._watchDogData.lastSeen));
    }
}

export class WatchDog extends EventEmitter {
    /**
     * returns the number of subscribers using the WatchDog object.
     */
    get subscriberCount(): number {
        return Object.keys(this._watchdogDataMap).length;
    }

    private readonly _watchdogDataMap: { [id: number]: IWatchdogData2 };
    private _counter: number;
    private _currentTime: number;
    private _timer: NodeJS.Timer | null;
    private readonly _visitSubscriberB: (...args: any[]) => void;

    constructor() {
        super();

        this._watchdogDataMap = {};
        this._counter = 0;
        this._currentTime = Date.now();
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
        const self = this;
        self._currentTime = Date.now();
        timeout = timeout || 1000;
        assert(_.isNumber(timeout), " invalid timeout ");
        assert(_.isFunction(subscriber.watchdogReset), " the subscriber must provide a watchdogReset method ");
        assert(!_.isFunction(subscriber.keepAlive));

        self._counter += 1;
        const key = self._counter;

        subscriber._watchDog = self;
        subscriber._watchDogData = {
            key,
            lastSeen: self._currentTime,
            subscriber,
            timeout,
            visitCount: 0
        } as IWatchdogData2;

        self._watchdogDataMap[key] = subscriber._watchDogData;

        if (subscriber.onClientSeen) {
            subscriber.onClientSeen(new Date(subscriber._watchDogData.lastSeen));
        }
        subscriber.keepAlive = keepAliveFunc.bind(subscriber);

        // start timer when the first subscriber comes in
        if (self.subscriberCount === 1) {
            assert(self._timer === null);
            this._start_timer();
        }

        return key;
    }

    public removeSubscriber(subscriber: ISubscriber) {
        if (!subscriber._watchDog) {
            return; // already removed !!!
        }
        if (!subscriber._watchDogData) {
            throw new Error("Internal error");
        }

        assert(subscriber._watchDog instanceof WatchDog);
        assert(_.isNumber(subscriber._watchDogData.key));
        assert(_.isFunction(subscriber.keepAlive));
        assert(this._watchdogDataMap.hasOwnProperty(subscriber._watchDogData.key));

        delete this._watchdogDataMap[subscriber._watchDogData.key];
        delete subscriber._watchDog;
        delete subscriber._watchDogData;
        delete subscriber.keepAlive;

        // delete timer when the last subscriber comes out
        if (this.subscriberCount === 0) {
            this._stop_timer();
        }
    }

    public shutdown(): void {
        assert(
          this._timer === null && Object.keys(this._watchdogDataMap).length === 0,
          " leaking subscriber in watchdog"
        );
    }

    private _visit_subscriber() {
        const self = this;

        self._currentTime = Date.now();

        const expiredSubscribers = _.filter(self._watchdogDataMap, (watchDogData: IWatchdogData2) => {
            watchDogData.visitCount += 1;
            return has_expired(watchDogData, self._currentTime);
        });

        // xx console.log("_visit_subscriber", _.map(expired_subscribers, _.property("key")));
        if (expiredSubscribers.length) {
            self.emit("timeout", expiredSubscribers);
        }
        expiredSubscribers.forEach((watchDogData: IWatchdogData2) => {
            self.removeSubscriber(watchDogData.subscriber);
            watchDogData.subscriber.watchdogReset();
        });
        // xx self._current_time = Date.now();
    }

    private _start_timer(): void {
        assert(this._timer === null, " setInterval already called ?");
        this._timer = setInterval(this._visitSubscriberB, 1000) as NodeJS.Timer;
    }

    private _stop_timer(): void {
        assert(this._timer !== null, "_stop_timer already called ?");
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }
}
