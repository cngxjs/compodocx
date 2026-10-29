# JSON export schema

`--exportFormat json` writes `documentation.json`. Its top-level `schemaVersion` names the shape of the file; `generatedAt` (ISO 8601) and `compodocxVersion` change on every run and are not part of the shape. This page lists every schema version, what changed between them, and how future changes are made. The TypeScript types of the export are declared in [`src/app/interfaces/export-data.interface.ts`](https://github.com/cngxjs/compodocx/blob/develop/src/app/interfaces/export-data.interface.ts).

## JSON Schema

The package ships a JSON Schema (draft 2020-12) of the current version at `node_modules/@cngxjs/compodocx/src/data/schemas/documentation.v6.schema.json`. Validate an export with any 2020-12 validator, for example with ajv:

```js
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '@cngxjs/compodocx/src/data/schemas/documentation.v6.schema.json' with { type: 'json' };

const validate = new Ajv2020({ strict: false }).compile(schema);
validate(documentation) || console.error(validate.errors);
```

The schema is generated from the TypeScript declaration of the export. Objects allow fields the schema does not list (`additionalProperties: true`), so a newer export with added optional fields still validates. Deprecated fields carry `deprecated: true`. `jsdoctags` entries are the TypeScript JSDoc nodes as the crawler writes them; the schema lists their documented fields and allows the node fields next to them.

## Compatibility policy

- Adding an optional field keeps the schema version. Readers ignore fields they do not know.
- Removing or renaming a field, or narrowing its type, raises the schema version.
- A field that is going to be removed is marked deprecated first and is still written for at least one minor release. It goes with the next schema version.
- A change of the values an existing field holds, without a change of its type, keeps the schema version. It is listed below under the current schema with the release that made it.
- Every change is listed on this page and in [MIGRATION.md](../MIGRATION.md).
- `compodocx diff` reads the current schema only; re-export stored baselines after an upgrade that changes it.

## Deprecated fields

| Field | Deprecated since | Removed with schema | Read instead |
|-|-|-|-|
| `components[].signal` | 0.12.0 | 7 | `signalKind` on the members |
| `directives[].signal` | 0.12.0 | 7 | `signalKind` on the members |
| `jsdoctags[] node fields` | 0.12.0 | 7 | the fields of `ExportJsdocTag` (`tagName`, `comment`, `name`, `type`, ...) |

The node fields of `jsdoctags` entries are the fields the TypeScript JSDoc node carries besides the documented ones: `pos`, `end`, `kind`, `id`, `flags`, `modifierFlagsCache`, `transformFlags`, `escapedText` in `tagName` and `name`, and further node references. The JSON Schema does not list them.

## Versions

| `schemaVersion` | Written by |
|-|-|
| none | compodoc and compodocx before 0.3.0 |
| `1` | compodocx 0.3.0 to 0.5.x |
| `2` | compodocx 0.6.0 to 0.8.x |
| `6` | compodocx 0.9.0 and later |

Schemas 3 to 5 were development steps towards 6 and were never published.

## Schema 6

### Introduced in 0.9.0

Removed:

- `modules` (top level) and `entryComponents` (components).
- `category` and `docsKind` on every entry and member.
- `referencedBy` on every entry; use `usedBy`.
- `factoryKind` on function entries; use `di.role`, `di.featureType` and `di.usesInjectionContext`.

Reshaped:

- `routes` is a list of typed route roots (`{ kind: 'router' | 'unmounted', bootstraps?, config?, features?, array?, routes }`) instead of one tree object, written only when the project has routes. References are `{ name, file?, source, call? }`.
- Style sources sit in the top-level `styleSources` map (`{ content, language }` per key); `themeStyleSources` on components lists keys into it.
- `inputsClass`, `outputsClass`, `hostBindings` and `hostListeners` come from signal APIs and the `host` object only; `guards` and `interceptors` list functional ones only.
- `themeOverview` on components is a string (it was declared `string[]`).

Changed values:

- Signal inputs and models: `defaultValue` is the initial value argument only, a string `alias` option is written as `alias`, and `type` is the first type argument.
- `providedIn` of services and injection tokens has no quotes (`root`).
- Generic type arguments are joined with `,` (`Record<string, number>`).
- `file` of theme tokens and theme style sources is relative to the working directory with forward slashes.
- Parameter types of top-level functions keep the declared type.

Added (optional): the semantic facts on every symbol entry (`entryPoint`, `exportedBy`, `notExported`, `usedBy`, `di`, `token`, `feature`, `axes`, `routedAt`, `mountedAt`, see [Semantic fields in the JSON export](configuration.md#semantic-fields-in-the-json-export)), the top-level `semantic` object, `services`, `styleFiles`, `tokens[].factory`, `tokenClass`, `call` on `providers` / `viewProviders` entries, `themeTokens` / `themeOverview` / `themeStyleSources` on directives, and `relatedTo` on tokens.

### Changed in 0.10.0

- Added (optional): the top-level `additionalPages` list.
- `jsdoctags[].comment` of an `@example` without a code fence is a code block (`<div class="cdx-code-snippet">...</div>`) instead of a paragraph.
- `destrucuredGroupId` is the position of the parameter (`<file>:<line>:<column>`) instead of a random UUID, so the export is the same on every run.
- Theme tokens documented with `@cssprop` carry `kind: 'css-hook'`, and a token documented in several style sheets of one component is listed once.

### Changed in 0.12.0

- Added: the JSON Schema of the export (see [JSON Schema](#json-schema)).
- Deprecated: `signal` on components and directives, and the TypeScript node fields of `jsdoctags` entries (see [Deprecated fields](#deprecated-fields)).
- `signal` on components and directives is `true` when the entry has an `input()`, `output()` or `model()` member or the class tag `@signal`; it was `true` only with the tag.
- `exampleUrls` holds the `<example-url>` tags of the entry's own JSDoc; it held every tag of the entry's file, so all classes of a file shared them.
- `description`, `rawdescription` and the `jsdoctags` comments of classes no longer contain `<example-url>` tags; the URLs are in `exampleUrls` only.
- With the new `exampleUrlBase` option, relative URLs in `exampleUrls` are written with the base in front.
- Declarations that their file does not export (functions, variables, interfaces, type aliases, enums, injection tokens) have no entry any more.

### Changed in 0.12.1

- A `@slot` whose comment runs over several lines has its first word in `slots[].name` and the rest, with the following lines, in `slots[].description`; the whole comment was the name and the description was empty. `<example-url>` lines after the last `@slot` are no longer part of it.

### Changed in 0.13.0

- `themeTokens` of components and directives and `tokens` of `styleFiles` entries leave out the custom properties whose name starts with `themingPrivatePrefix` (default `--_`) and every token whose doc block carries `@internal`. Entries with `kind: 'css-hook'` are kept whatever their name. `false` for `themingPrivatePrefix` writes the named properties again.

## Schema 2

Written by 0.6.0 to 0.8.x. Additive over schema 1, nothing was removed:

- Top-level `tokens` (injection tokens, same shape as `injectables`).
- Optional `docsKind`, `wcagLevel`, `a11yNote`, `taggedSelector` and `relatedTo` on directives, components, interfaces, classes and tokens.

## Schema 1

Written by 0.3.0 to 0.5.x. The first export with the header fields `schemaVersion`, `generatedAt` and `compodocxVersion`. Top-level lists: `pipes`, `modules`, `interfaces`, `injectables`, `guards`, `interceptors`, `classes`, `directives`, `routes`, `coverage`, `miscellaneous` and `components`.
