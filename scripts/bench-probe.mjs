// Preload for scripts/bench.mjs. Loaded into the measured child via
// `node --import`; on exit it writes wall time and peak RSS as JSON to the
// path in CDX_BENCH_OUT. Portable replacement for `/usr/bin/time`.

import { writeFileSync } from 'node:fs';

const MIN_PLAUSIBLE_RSS_BYTES = 10 * 1024 * 1024;

const outPath = process.env.CDX_BENCH_OUT;

if (outPath) {
    process.on('exit', () => {
        // Node documents resourceUsage().maxRSS in kilobytes on every platform.
        const maxRssBytes = process.resourceUsage().maxRSS * 1024;
        const wallMs = Math.round(process.uptime() * 1000);
        if (maxRssBytes < MIN_PLAUSIBLE_RSS_BYTES) {
            console.error(
                `bench-probe: implausible peak RSS ${maxRssBytes} bytes - maxRSS unit changed?`
            );
            process.exitCode = 3;
            return;
        }
        writeFileSync(outPath, JSON.stringify({ maxRssBytes, wallMs }));
    });
}
