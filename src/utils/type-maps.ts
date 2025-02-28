import type { LogType } from "consola";
import type { ColorName } from "consola/utils";
import isUnicodeSupported from "#/utils/is-unicode-supported";

const unicode: boolean = isUnicodeSupported();
const s: (c: string, fallback: string) => string = (c: string, fallback: string): string => (unicode ? c : fallback);

export const TEXT_TYPES: string[] = [
    "error",
    "warn",
    "info",
    "success",
    "debug",
    "trace",
    "start",
    "log",
    "silent",
    "ready",
    "box",
    "verbose",
];

export const TYPE_PREFIX: { [k in LogType]?: string } = {
    error: "ERROR",
    fatal: "FATAL",
    ready: "READY",
    warn: "WARN",
    info: "INFO",
    success: "SUCCESS",
    debug: "DEBUG",
    trace: "TRACE",
    fail: "FAIL",
    start: "START",
    log: "",
};

export const TYPE_COLOR_MAP: { [k in LogType]?: ColorName } = {
    error: "red",
    fatal: "bgRed",
    ready: "green",
    warn: "yellow",
    info: "blue",
    success: "magenta",
    debug: "cyan",
    trace: "gray",
    fail: "red",
    start: "blue",
    log: "white",
};

export const MESSAGE_COLOR_MAP: { [k in LogType]?: ColorName } = {
    error: "red",
    fatal: "red",
    ready: "green",
    warn: "yellow",
    info: "blue",
    success: "green",
    debug: "cyan",
    trace: "gray",
    fail: "red",
    start: "blue",
    log: "gray",
};

export const CONTAINER_TYPE_PREFIX: { [k in LogType]?: string } = {
    error: s("✖", "×"),
    fatal: s("✖", "×"),
    ready: s("✔", "√"),
    warn: s("⚠", "‼"),
    info: s("ℹ", "i"),
    success: s("✔", "√"),
    debug: s("⚙", "D"),
    trace: s("→", "→"),
    fail: s("✖", "×"),
    start: s("◐", "o"),
    verbose: s("⋮", "V"),
    log: "",
};
