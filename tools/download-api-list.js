const https = require('node:https');
const fs = require('node:fs');

const MANIFEST_URL = 'https://angular.dev/assets/api/manifest.json';
const OUTPUT_PATH = 'src/data/api-list.json';

// Map angular.dev ApiItemType to compodocx docType
const TYPE_MAP = {
    block: 'block',
    undecorated_class: 'class',
    constant: 'const',
    decorator: 'decorator',
    directive: 'directive',
    element: 'element',
    enum: 'enum',
    function: 'function',
    interface: 'interface',
    pipe: 'pipe',
    ng_module: 'ngmodule',
    type_alias: 'type-alias',
    initializer_api_function: 'function'
};

function getStability(entry) {
    if (entry.deprecated) {
        return 'deprecated';
    }
    if (entry.developerPreview) {
        return 'experimental';
    }
    if (entry.experimental) {
        return 'experimental';
    }
    return 'stable';
}

function getPackagePath(normalizedModuleName) {
    let name = normalizedModuleName;
    if (name.startsWith('angular_')) {
        name = name.slice('angular_'.length);
    }
    return name.replace(/_/g, '/');
}

function convertManifest(manifest) {
    return manifest.map(pkg => {
        const packagePath = getPackagePath(pkg.normalizedModuleName);
        const title = pkg.moduleLabel.replace('@angular/', '');

        return {
            name: title.toLowerCase().replace(/\//g, '-'),
            title,
            path: `api/${packagePath}`,
            items: pkg.entries.map(entry => ({
                name: entry.name.toLowerCase(),
                title: entry.name,
                path: `api/${packagePath}/${entry.name}`,
                docType: TYPE_MAP[entry.type] || entry.type,
                stability: getStability(entry),
                securityRisk: false
            }))
        };
    });
}

/**
 * Merge a fresh list into the current one. Entries the manifest no longer
 * lists stay (projects keep using deprecated and removed APIs), entries it
 * still lists take the manifest's values, new entries and packages are
 * appended in manifest order, so existing lookups resolve as before.
 */
function mergeApiList(current, fresh) {
    const freshByName = new Map(fresh.map(pkg => [pkg.name, pkg]));
    const merged = current.map(pkg => {
        const update = freshByName.get(pkg.name);
        if (!update) {
            return pkg;
        }
        const updates = new Map(update.items.map(item => [item.title, item]));
        const items = pkg.items.map(item => updates.get(item.title) ?? item);
        const known = new Set(pkg.items.map(item => item.title));
        return {
            ...pkg,
            ...update,
            items: [...items, ...update.items.filter(item => !known.has(item.title))]
        };
    });
    const knownPackages = new Set(current.map(pkg => pkg.name));
    return [...merged, ...fresh.filter(pkg => !knownPackages.has(pkg.name))];
}

const countEntries = list => list.reduce((sum, pkg) => sum + pkg.items.length, 0);

function download() {
    https
        .get(MANIFEST_URL, res => {
            if (res.statusCode !== 200) {
                console.error(`Download failed: ${res.statusCode}`);
                process.exit(1);
            }

            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const manifest = JSON.parse(data);
                    const current = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
                    const apiList = mergeApiList(current, convertManifest(manifest));
                    const before = countEntries(current);
                    const after = countEntries(apiList);

                    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(apiList, null, 2));
                    console.log(
                        `Written ${apiList.length} packages with ${after} entries to ${OUTPUT_PATH} (was ${before}, ${after - before} added)`
                    );
                } catch (err) {
                    console.error('Failed to parse manifest:', err.message);
                    process.exit(1);
                }
            });
        })
        .on('error', err => {
            console.error('Download error:', err.message);
            process.exit(1);
        });
}

if (require.main === module) {
    download();
}

module.exports = { convertManifest, mergeApiList };
