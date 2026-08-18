import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
export function loadStore(path) {
    try {
        const raw = readFileSync(path, 'utf8');
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const seen = new Set();
        return {
            peakWindows: Array.isArray(parsed.peakWindows) ? parsed.peakWindows : undefined,
            items: items.filter(item => {
                if (!item?.id || seen.has(item.id)) {
                    return false;
                }
                seen.add(item.id);
                return true;
            }),
        };
    }
    catch (error) {
        const code = typeof error === 'object' && error && 'code' in error
            ? error.code
            : undefined;
        if (code === 'ENOENT') {
            return { items: [] };
        }
        throw error;
    }
}
export function saveStore(path, store) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}
