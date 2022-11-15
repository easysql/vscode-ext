export class Utils {
    static dateStr(_date?: Date): string {
        const date = _date || new Date();
        const pad = (d: number) => {
            const dStr = d.toString();
            return dStr.length == 1 ? '0' + dStr : dStr;
        };
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${date.getHours()}:${date.getHours()}:${date.getMinutes()}`;
    }
}

type LoggerLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export class Logger {
    private prefix: String = 'EasySQL';
    constructor(public level: LoggerLevel) {}
    private levelIds: { [level: string]: number } = { DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
    private levelId = this.levelIds[this.level];

    setLevel(level: LoggerLevel) {
        this.level = level;
        this.levelId = this.levelIds[level];
    }

    timed<R>(func: () => R, level: LoggerLevel, _msg: string, ...args: any): R {
        const start = new Date();
        this.log(level, `Start to ${_msg}`, ...args);
        try {
            const result = func();
            const end = new Date();
            const timeSpent = end.getTime() - start.getTime();
            this.log(level, `(Time spent: ${timeSpent}ms) Succeeded to ${_msg}`, ...args);
            return result;
        } catch (err) {
            const end = new Date();
            const timeSpent = end.getTime() - start.getTime();
            this.log(level, `(Time spent: ${timeSpent}ms) Failed to ${_msg}`, ...args);
            throw err;
        }
    }

    log(level: LoggerLevel, _msg: string, ...args: any) {
        if (this.levelId > this.levelIds[level]) {
            return;
        }
        const msg = `[${this.prefix}][${level}][${Utils.dateStr()}] ${_msg}`;
        if (level === 'DEBUG') {
            console.debug(msg, ...args);
        } else if (level === 'INFO') {
            console.info(msg, ...args);
        } else if (level === 'WARN') {
            console.warn(msg, ...args);
        } else if (level === 'ERROR') {
            console.error(msg, ...args);
        }
    }

    info(msg: string, ...args: any) {
        this.log('INFO', msg, ...args);
    }

    debug(msg: string, ...args: any) {
        this.log('DEBUG', msg, ...args);
    }
    warn(msg: string, ...args: any) {
        this.log('WARN', msg, ...args);
    }
    error(msg: string, ...args: any) {
        this.log('ERROR', msg, ...args);
    }
}

export const logger = new Logger('INFO');
