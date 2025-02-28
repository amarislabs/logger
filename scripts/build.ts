import dts from "@amarislabs/bun-plugin-dts";
import type { BuildConfig } from "bun";

const performanceStart: number = performance.now();

const defaultBuildConfig: BuildConfig = {
    entrypoints: ["./src/index.ts"],
    outdir: "./dist",
    minify: true,
    target: "bun",
    external: ["consola"],
};

await Bun.build({
    ...defaultBuildConfig,
    plugins: [
        dts({
            cacheDir: ".cache",
        }),
    ],
    format: "esm",
    naming: "[dir]/[name].js",
});

function formatTime(ms: number): string {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(2)} seconds`;
    }
    return `${ms.toFixed(2)}ms`;
}

const performanceEnd: number = performance.now() - performanceStart;

console.log("");
console.log("Build completed in", formatTime(performanceEnd));
