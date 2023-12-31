import { Events } from "../models/events";
import { APP_EVENTS } from "./emitter/emit.interface";
import { emitterService } from "./emitter/emitter.service";

class Logger {
    constructor(
        private write: (...str: string[]) => void = console.log,
        private emitter: typeof emitterService
    ) {
        this.emitter.on(APP_EVENTS.EVENT.CREATION, (e) => this.onEventCreation(e));
    }

    /**
     * This method is meant to be called when a {@link Events}
     * is created, it receives the said event
     */
    onEventCreation(event: Events)  {
        this.write('Un evento ha sido creado: ', 
            JSON.stringify(event, null, 2)
        );
    }
}

export function setupLogger() {
    return new Logger(
        console.log,
        emitterService
    );
}