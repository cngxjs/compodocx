# Theme Tokens: Authoring Guide


## When to apply this guide

Use it when you are:

- adding a new theme token (custom property, SCSS variable, or `@property` rule) to a component
- retrofitting documentation onto an existing component stylesheet
- reviewing a component's stylesheet for a documentation pass
- generating a component scaffold that should ship with a documented theming surface from day one

If you only consume tokens (e.g. you are styling a page that uses someone else's component), this guide does not apply.

## Quick reference

This is the smallest possible cheat sheet. Skim this first; everything below is detail.

```scss
// SCSS variable
/// Description here.
/// @type Length
/// @default 8px
/// @group container
$padding: 8px !default;
```

```css
/* CSS custom property */
/**
 * Description here.
 * @type <color>
 * @default #fff
 * @group container
 */
:host {
    --bg: #fff;
}
```

```css
/* @property at-rule (recommended for runtime-typed tokens) */
/**
 * Description here.
 * @group container
 */
@property --gap {
    syntax: '<length>';
    inherits: true;
    initial-value: 12px;
}
```

```css
/* Hook: a property the component reads but never sets */
/**
 * Text colour of the badge.
 * @cssprop {<color>} [--badge-color=#06c] - Falls back to the accent colour.
 */
```

```css
/* File-level intro */
/**
 * @overview
 * One-paragraph description of what this stylesheet exposes.
 * Multiple `@overview` blocks are concatenated in source order.
 */
```

```scss
// Free-standing style file (listed in `styleFiles`) that themes a directive
/// @overview
/// Tokens of the tooltip directive.
/// @themes AcmeTooltip
```

```scss
/// Documented mixin
/// Applies the focus ring.
/// @param {Color} $color [currentColor] - Ring colour.
@mixin focus-ring($color: currentColor) { /* ... */ }
```

The parser does the rest. The tokens land in the component's **Theming** tab, grouped by `@group`, with the type, default value, description, examples, and `@see` cross-links rendered automatically.

## Core mental model

The parser thinks like JSDoc, not like a CSS preprocessor. Three rules cover almost everything:

1. **Doc blocks attach to the next declaration.** A `///` block (SCSS) or `/** */` block (CSS) immediately above a `$variable: ...;`, `--property: ...;`, or `@property --name { ... }` describes that target. Anything other than blank lines between the block and the target breaks the association silently.

2. **`@overview`, `@themes` and `@cssprop` claim the block.** A doc block carrying `@overview` or `@themes` describes the file and is never associated with a following declaration. Use it for a one-paragraph description at the top of the file and for the file-level links. A block carrying `@cssprop` documents the hook it names and is claimed the same way.

3. **Single-asterisk `/* */` blocks are invisible.** Only `/**` (two asterisks) opens a doc comment. SCSS `//` line comments (one or two slashes, not three) are also invisible.

That is the whole model. Everything else is tag semantics.

## Authoring patterns

### Pattern 1: SCSS variable with SassDoc

Use `///` line comments (three slashes). Each line of the block continues the description until a `@tag` starts the tag block. The block must sit directly above the `$var: value [!default];` declaration; only blank lines may separate them.

```scss
/// Padding inside the alert container.
/// @type Length
/// @default 12px 16px
/// @group container
$alert-padding: 12px 16px !default;
```

Multiple variables in a row each need their own `///` block:

```scss
/// Inner radius of the alert container.
/// @type Length
/// @default 8px
/// @group container
$alert-radius: 8px !default;

/// Severity-specific danger background.
/// @type Color
/// @group severity
$alert-danger-bg: #fee2e2 !default;
```

### Pattern 2: CSS custom property with JSDoc

Use `/** */` (two asterisks at the open, exactly). The block can sit either directly above the `--property:` declaration **or** above the wrapping selector when the selector has the property as its first inner declaration.

Both of these work and produce the same token:

```css
/* Doc above the property */
:host {
    /**
     * Background colour of the alert container.
     * @type <color>
     * @default #f8fafc
     * @group container
     */
    --acme-alert-bg: #f8fafc;
}
```

```css
/* Doc above the wrapping selector */
/**
 * Background colour of the alert container.
 * @type <color>
 * @default #f8fafc
 * @group container
 */
:host {
    --acme-alert-bg: #f8fafc;
}
```

The first form is preferred when a single `:host { }` block contains many properties, because it keeps each token's documentation next to its declaration. The second form is fine when a wrapping selector exists only to scope a single property.

### Pattern 3: `@property` at-rule (recommended)

Native `@property` is the strongest pattern when your supported browsers allow it. The browser-native `syntax` populates the **Type** column and `initial-value` populates the **Default** column, so you do not need to repeat them in the doc block:

```css
/**
 * Inner gap between icon, body, and dismiss button.
 * @group container
 */
@property --acme-alert-gap {
    syntax: '<length>';
    inherits: true;
    initial-value: 12px;
}
```

Explicit `@type` and `@default` tags still win over the browser-native descriptors when both are set. This is useful when you want to document the *intent* in human terms while keeping the runtime-checkable native version too:

```css
/**
 * @type Length (one to four values)
 * @default 12px 16px (vertical / horizontal)
 * @group container
 */
@property --acme-alert-padding {
    syntax: '<length>+';
    inherits: true;
    initial-value: 12px 16px;
}
```

### Pattern 4: File-level intro with `@overview`

A doc block carrying `@overview` becomes the first paragraph on the Theming tab, above the navigable index. Multiple `@overview` blocks across all resolved style files are concatenated in source order.

```css
/**
 * @overview
 * Theme tokens for the **alert** component. Override these in your
 * global stylesheet to retheme every alert at once. Severity-specific
 * tokens (`--acme-alert-danger-bg` etc.) override the base values.
 */
```

The body uses Markdown: `**bold**`, `_italic_`, ` ``code`` `, `[links](url)`, `> blockquote`, lists. `{@link --acme-alert-bg}` links to that token's row on the same tab (a token without a row there renders as code); `{@link AcmeAlert}`, URLs and `.md` / `.html` files resolve like `{@link}` in any other description, and a name that is none of these renders as code.

### Pattern 5: hook token (read, not set)

A component often only reads a custom property, for example `color: var(--badge-color, var(--accent, #06c))`, and never declares it. There is no declaration a doc block could sit above, so the block names the property itself with `@cssprop` (or its alias `@cssproperty`). The form is the one of the custom-elements-manifest, so a library that already documents its properties for that tooling needs no edits:

```css
/**
 * Text colour of the badge.
 *
 * @cssprop {<color>} [--badge-color=var(--accent)] - Falls back to the accent colour.
 * @cssprop --badge-gap - Space between icon and label.
 */
```

Every part of the line except the name is optional:

| Part | Meaning |
|-|-|
| `{<syntax>}` | The type, shown in the Type cell. Braces inside the syntax are fine (`{<length>{1,4}}`) |
| `[--name=default]` | The name with a default. The default is taken as written and never guessed from a `var()` fallback chain |
| `- text` | The description of this property. Without it, the description of the block is used |

A separate `@type` or `@default` tag in the block wins over the inline forms. Several `@cssprop` lines in one block give one hook each; they share the other tags of the block (`@group`, `@since`, `@deprecated`, `@see`, `@example`, `@relatedTo`). Only the lowercase spellings `@cssprop` and `@cssproperty` are read. The name must start with `--`; a line without a usable name is reported as an [unknown tag](#unknown-tags).

A hook block never attaches to the declaration below it, so it can sit anywhere. Hooks show on the Theming tab with a **Hook** badge ("Read by the component, not set by it"), in the style page, in the JSON export with `kind: 'css-hook'` and in the llm-md export like any other token.

`@cssprop` lines also work inside an `@overview` or `@themes` block, which is handy for a free-standing style file that lists the hooks of the component it themes. There only the inline text counts as the description, because the description of that block is the file overview.

If the same stylesheet also declares the property (`--badge-color: ...;` or `@property --badge-color`), the declaration wins: the token becomes that kind of token at the declaration's line and the build says so, see [Hook and declaration in one sheet](#hook-and-declaration-in-one-sheet).

## Tag reference

| Tag | Value | Effect |
|-|-|-|
| `@overview` | Markdown body, may span multiple lines | File-level intro paragraph rendered above the index. The tag claims the block: do NOT mix `@overview` with token-describing tags in the same block |
| `@type` | CSS type expression (`<length>`, `<color>`, `<length-percentage>+`, `Number`, `String`, free-form text) | Renders in the **Type** cell next to the token name |
| `@default` | Any string | Renders in the **Default** cell. Falls back to the literal declaration value when omitted; for `@property`, falls back to `initial-value` |
| `@group` | Identifier (kebab-case recommended: `container`, `severity`, `icon`) | Groups tokens under a sub-heading. Tokens without `@group` sit in a flat default bucket above all named groups |
| `@example` | Fenced code block, multi-line, repeatable | Rendered below the description as a Shiki-highlighted snippet. Format: `` ```css\n…\n``` ``. The language tag inside the fence drives highlighting |
| `@since` | Version string (`0.1.0`, `1.2.0-beta.3`) | Adds a small "since" badge next to the token name |
| `@deprecated` | Optional reason, free-form text | Strikes through the token name and renders the reason as muted prose. Bare `@deprecated` (no reason) still strikes the name |
| `@see` | URL, repeatable; OR token name (`--other-token`, `$other-var`), repeatable | Rendered as a comma-separated link list at the bottom of the description. Token references resolve to in-page anchors |
| `@relatedTo` | `Name[, Name]`, symbol names | On a token or mixin: a "Related" row of links to the named symbols. At file level (in the `@overview` block): a Related section on the style page. See [`@relatedTo`](#relatedto) |
| `@cssprop` | `{<syntax>} [--name=default] - description`, repeatable; every part but the name is optional | Documents a property the component reads and never sets (a hook). The block never attaches to the next declaration. See [Pattern 5](#pattern-5-hook-token-read-not-set) |
| `@cssproperty` | Same as `@cssprop` | Alias of `@cssprop` |
| `@themes` | `Name[, Name...]`, comma or space separated, repeatable | File level only. Links a free-standing style file to the components and directives it themes. See [`@themes`](#linking-a-file-with-themes) |
| `@internal` | None | Hides what the block documents (token, `@property`, hook, SCSS mixin or function) from the docs. In a file-level block it hides the `@cssprop` lines only. See [Hiding tokens from the docs](#hiding-tokens-from-the-docs) |

Which tags are read where:

| Position | Tags |
|-|-|
| Token (variable, custom property, `@property`) | `@type`, `@default`, `@group`, `@example`, `@since`, `@deprecated`, `@see`, `@relatedTo`, `@internal` |
| Hook block (carries `@cssprop`) | `@cssprop`/`@cssproperty` plus the token tags above, shared by the hooks of the block |
| File level (`@overview` block or a block carrying `@themes`) | `@overview`, `@themes`, `@relatedTo`, `@cssprop`/`@cssproperty`, `@internal` |
| SCSS mixin or function | `@param`, `@content`, `@return`, `@output`, `@example`, `@since`, `@deprecated`, `@see`, `@relatedTo`, `@internal` |

Any other tag is dropped and reported in the build log, see [Unknown tags](#unknown-tags).

## Positioning rules

The parser is intentionally strict about position. These all **fail silently** (token not extracted):

```scss
/// Doc here
body { color: red; }      // Unrelated declaration breaks the chain
$padding: 8px;            // Token NOT documented
```

```css
/**
 * Doc here
 */
.unrelated { color: red; }  // Unrelated rule breaks the chain
:host { --foo: 1; }         // Property NOT documented
```

```css
/* Single-asterisk block - INVISIBLE to the parser */
:host { --foo: 1; }
```

These all **succeed**:

```scss
/// Doc here
$foo: 8px;                  // Direct association

/// Doc here

$bar: 8px;                  // Blank lines OK

/// Doc here
$baz: 8px !default;         // !default modifier OK
```

```css
/**
 * Doc here
 */
:host {
    --foo: 1;               // Doc above wrapper, single-prop body
}

:host {
    /**
     * Doc here
     */
    --foo: 1;               // Doc directly above prop (preferred)
}

/**
 * Doc here
 */
@property --foo {           // Doc above @property at-rule
    syntax: '<length>';
    inherits: true;
    initial-value: 8px;
}
```

A block that carries `@cssprop` is the exception to the first rule above: it never attaches to the next declaration, so a declaration right below it needs a doc block of its own.

## Same token in several sheets

A token that is documented more than once under the same name in one component (for example as `@property` in a theme sheet and as a `:host` declaration with the description in the base sheet), in one style file, or in a component and the files that theme it, is listed once. The pieces are merged:

| Field | Rule |
|-|-|
| Kind, file, line | From the strongest declaration: `@property` beats a custom property or SCSS variable, which beats a hook. On a tie the first in style-source order wins |
| Type, default | From that winner; if it has none, the first sheet that has one |
| Description, group, examples, since, see, related | From the first sheet that has them. Lists are taken whole, never concatenated |
| Deprecated | From the winner; if it is not deprecated, the first sheet that is |
| Position | Where the name first appeared |

`$name` and `--name` never merge. The same token written in two components stays two tokens, one per component.

## Hook and declaration in one sheet

A `@cssprop` line above a property that the same sheet declares is a habit carried over from the manifest tooling. The declaration is the better source, so the hook is replaced by it (default from `@default` or the inline default, else the declared value or `initial-value`; type from `@type` or the inline type, else the `@property` syntax) and the build logs one line per name, still exiting with code 0:

```text
Style comments: 1 hook token also declared in its sheet, declaration kept
  src/chip/chip.css:22 --chip-bg
```

Declarations in another sheet of the same component are not a conflict; they merge as described above.

## Hiding tokens from the docs

A helper property that only the stylesheet itself reads is not part of the theming surface. Add `@internal` to its doc block and it is hidden from the docs: no row on the Theming tab, the style page or `design-tokens.html`, and no entry in the JSON and llm-md exports. CSS has no private custom properties, so this hides the property from the docs only; it still works in the browser like any other.

```css
/**
 * Width reserved for the overflow badge, copied from the public token.
 * @internal
 */
@property --acme-chip-reserve {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
}
```

Custom properties named with `--_` are hidden the same way without a tag, documented or not, `@property` rule or declaration. A `@cssprop` hook named `--_...` stays, because the tag names it on purpose. The prefix is the config key [`themingPrivatePrefix`](configuration.md#hidden-tokens) (default `'--_'`, `false` lists every property). A style file left with hidden tokens only, no overview and no documented mixin, gets no page.

SCSS variables follow the Sass rule instead: a variable whose name starts with `_` or `-` (`$_gap`, `$-gap`) is private to its module and never listed, documented or not, like private mixins. `themingPrivatePrefix` does not change that.

`@internal` works on every kind of block that documents something: a `@property` rule (an undocumented `@property` rule is listed on its own, but not one hidden this way), a custom property declaration, the first property inside a selector, a `@cssprop` block, an SCSS variable, mixin or function. In an `@overview` or `@themes` block it hides the `@cssprop` lines of that block and leaves the overview and the links as they are. The tag takes no value, it is never reported as unknown, and a block that carries it is never reported as [unattached](#unattached-blocks).

## Source resolution

The parser walks every component and reads:

1. Each entry in the component's `styleUrls`, resolved relative to the component's `.ts` file.
2. Each string in the component's inline `styles[]` array, treated as anonymous CSS keyed `<inline-style-0>`, `<inline-style-1>`, ...
3. For SCSS files only, top-level `@import` and `@use` rules are followed **one level deep**. Use this for shared token partials:

```scss
// _tokens.scss (the partial)
/// Shared brand surface.
/// @type Color
/// @group brand
$brand-primary: #2563eb !default;
```

```scss
// alert.component.scss (the component stylesheet)
@use './tokens';

/// Alert-specific override.
/// @type Color
/// @group container
$alert-bg: $tokens.$brand-primary !default;
```

Both `$brand-primary` and `$alert-bg` end up on the alert's Theming tab.

Components without `styleUrls` and without inline `styles[]` produce zero tokens, and the Theming tab is omitted automatically.

Directives get a Theming tab only from free-standing style files that name them with `@themes`. Other entities (services, classes, interfaces, pipes, guards, interceptors) never produce a Theming tab.

## Free-standing style files

Stylesheets that no component reads through `styleUrl` / `styleUrls` (a theme bridge, the CSS asset of a directive, a global token sheet) are documented when the config file lists them in `styleFiles`:

```json
{
    "styleFiles": ["projects/*/theming/**/*.css", "projects/themes/**/*.{css,scss}"]
}
```

The globs are relative to the config file's folder (the `-p` tsconfig folder when there is no config file). `node_modules`, `dist`, `.git` and the output folder are never matched; matches that are not `.css` / `.scss` warn once and are ignored. A file that a component already reads as `styleUrl` / `styleUrls` is skipped and stays on that component's Theming tab.

A matched file is documented when it has at least one of:

- an `@overview`,
- a documented token: a description, `@type` or `@group` (an undocumented `@property` alone does not count),
- a documented SCSS mixin or function.

A file without any of these gets no page and no export entry. The build log counts the files and names the first five without documented content:

```text
Style files: 12 (5 pages, 6 linked to 8 symbols, 1 without documented content)
1 style files have no documented tokens, mixins or overview: projects/themes/legacy.css
```

Where a documented file shows up:

- **On a symbol's Theming tab** when the file names the symbol in `@themes`. The tokens, the overview (under a sub-heading with the file name) and the source join the tab, which names the linked file.
- **On a style page**, `<file name>.html` in the file's feature folder, when the file themes no symbol, themes two or more, or has documented mixins. A file that themes exactly one symbol and has no mixins shows on that symbol's tab only. The page has the file name, a CSS/SCSS badge, the entry point and feature, an import line (from the nearest `package.json` `exports` entry that maps the file: `@use '<name>/<subpath>';` for SCSS, `@import '<name>/<subpath>';` for CSS), then Overview, Theming (the symbols it themes), Tokens, Mixins and Source.
- **On the design tokens page**, `design-tokens.html`, when the file themes no symbol: its documented tokens join every other such file's tokens, grouped by `@group` (the default group first, then by name). Each row links the file's style page. Token anchors are `token-<name>`; a name that a later file defines again gets `-2` and a build warning, so keep global token names unique.
- **On the feature page** of the feature the file falls into: style pages with the first sentence of their overview and their token and mixin counts, and a link to the design tokens page when the feature feeds it.

Style files are placed into features like symbols. Document global tokens with `@group`, since the design tokens page groups by it.

## Linking a file with `@themes`

`@themes Name[, Name...]` links a free-standing style file to the components and directives it themes. Names are resolved like `{@link}` names; comma and space both separate them, and several `@themes` lines add up. Write the tag in the file's `@overview` block or in a block of its own. A block carrying `@themes` describes the file and never documents the declaration after it.

A directive asset, theming one directive:

```css
/**
 * @overview
 * Tokens of the tooltip directive. Override them on any ancestor
 * to retheme every tooltip below it.
 * @themes AcmeTooltip
 */

/**
 * Tooltip background.
 * @type <color>
 * @default #1f2937
 * @group surface
 */
@property --acme-tooltip-bg {
    syntax: '<color>';
    inherits: true;
    initial-value: #1f2937;
}
```

`AcmeTooltip` gets a Theming tab with the overview, the token and the source. The file themes one symbol and has no mixins, so it gets no page of its own.

A theme bridge, theming several targets:

```scss
/// @overview
/// Bridges the Material theme to the button and card tokens.
/// @themes AcmeButton, AcmeCard
/// @themes AcmeChip

/// Accent used by buttons, cards and chips.
/// @type Color
/// @group accent
$acme-accent: #6366f1 !default;
```

Each of `AcmeButton`, `AcmeCard` and `AcmeChip` shows the token on its Theming tab, and the file gets a style page that lists all three under Theming.

A name that is not found, is not a component or directive, or names several components or directives logs one warning per file:

```text
Style file projects/themes/bridge.scss: @themes AcmeCrad not found; @themes ACME_CONFIG is not a component or directive
```

`@themes` is the only link between a style file and a symbol, besides a component's own `styleUrl`. There is no matching by selector, token name or file name.

## `@relatedTo`

`@relatedTo Name[, Name]` points at the symbols a token or a file belongs with.

On a token, it renders a "Related" row of links below the description. A name that resolves to nothing renders as code:

```css
/**
 * Elevation of open menus.
 * @type Box shadow
 * @group surface
 * @relatedTo AcmeMenu, AcmeSelect
 */
:host {
    --acme-menu-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}
```

At file level, in the `@overview` block, it renders a Related section on the style page:

```scss
/// @overview
/// Global spacing scale.
/// @relatedTo AcmeStack, AcmeGrid
```

## Documented mixins and functions

A `///` block directly above `@mixin name(...)` or `@function name(...)` documents it. Write it in SassDoc style:

```scss
@use 'sass:math';

/// Lays out children in a responsive grid.
/// @param {Number} $columns [12] - Column count on wide screens.
/// @param {Length} $gap - Space between cells.
/// @content Extra rules applied to every cell.
/// @example scss
///   .gallery {
///     @include acme-grid(4, 16px) { min-width: 0; }
///   }
@mixin acme-grid($columns: 12, $gap: 8px) {
    display: grid;
    grid-template-columns: repeat($columns, 1fr);
    gap: $gap;
    > * { @content; }
}

/// Converts a pixel value to rem.
/// @param $px The value in pixels.
/// @return The value in rem, relative to 16px.
@function acme-rem($px) {
    @return math.div($px, 16px) * 1rem;
}
```

- Parameters come from the signature (`$name: default`, multi-line and map defaults included). `@param {Type} $name [default] - text` (SassDoc) and plain `@param $name text` are both read. A parameter without a `@param` line is still listed.
- `@content` describes the content block, `@return` the result of a function, `@example scss` with an indented code block renders as a highlighted example.
- `@since`, `@deprecated`, `@see` and `@relatedTo` work as on tokens.
- Private names (`_x`, `-x`) and mixins without a doc block are not shown.

Documented mixins render in a **Mixins** section on the Theming tab and on the style page. A free-standing file with documented mixins always gets a style page. The section ID for `themingTabSections` is `mixins`; the default list is `overview`, `index`, `tokens`, `mixins`, `source`, so a project that sets the list explicitly must add `mixins`.

## Unknown tags

A tag the parser does not read in its position (see "Which tags are read where" in the [Tag reference](#tag-reference)) is dropped. It does not end up in the description. Tags inside an `@overview` block other than `@themes`, `@relatedTo` and `@cssprop`/`@cssproperty` count as unknown. The build reports them once per run and still exits with code 0:

```text
Style comments: 2 unknown tags ignored (@todo x1, @note x1)
  src/theming/button.css:14 @todo
  src/theming/button.css:31 @note
```

Text you want readers to see belongs in the description, above the first tag.

## Unattached blocks

A doc block that carries at least one token tag (`@type`, `@default`, `@group`, `@example`, `@since`, `@deprecated`, `@see`, `@relatedTo`) but documents nothing is reported too: no property, `@property` or SCSS variable follows it, or something else sits in between. Blocks with prose only, blocks with only unknown tags, file-level blocks, hook blocks, blocks with `@internal` and the block above a private SCSS mixin or variable are not reported.

```text
Style comments: 2 doc blocks not attached
  src/chip/chip.theme.css:14
  src/chip/chip.scss:3
```

The location is the first line of the block. The build still exits with code 0.

## Anti-patterns

These compile cleanly but produce no documentation. Audit for them when retrofitting:

| Anti-pattern | Symptom | Fix |
|-|-|-|
| `/* */` instead of `/** */` | Token missing from Theming tab; no parser error | Add the second asterisk |
| `//` instead of `///` (SCSS) | Token missing | Use three slashes |
| Doc block above an unrelated rule | Token after the doc not documented | Move the doc directly above its target, or remove the intervening rule |
| `@overview` or `@themes` mixed with `@type`/`@default` in the same block | Token not documented; the block describes the file, and the token tags are reported as unknown | Split into two blocks: one for the file, one for the token |
| Free-standing stylesheet not listed in `styleFiles` | File not documented | Add a matching glob to `styleFiles` |
| `@themes` names a service or misspelled name | Build warning `Style file <file>: @themes X not found` or `is not a component or directive`; no link | Use the exact class name of a component or directive |
| Note written as a custom tag (`@todo`, `@note`) | Text missing from the page; listed under `Style comments: ... unknown tags ignored` | Move the text into the description |
| Missing `@group` on some tokens, set on others | Ungrouped tokens land in the flat default bucket above the named groups, may look "out of place" | Either group every token consistently or accept the flat-first layout intentionally |
| `@type Length` written as `@type "Length"` | Quotes appear in the rendered cell | Tags are free-form; do not quote |
| Multiple `@default` lines | Last one wins; the others are silently dropped | Use one `@default` per token |
| `@property --foo { syntax: '<color>'; ... }` with `@type Length` in the doc | Explicit `@type` overrides: the cell shows `Length` even though the runtime accepts `<color>` only | Match the doc to the runtime, or omit `@type` and let the merge fill it |
| `@cssprop` above a property the same sheet declares | The declaration is used and the build logs `hook token also declared in its sheet` | Keep the hook only for properties the sheet never declares, or drop the tag |
| `@cssProperty` or `@CSSPROP` | Listed as an unknown tag; no hook | Use the lowercase `@cssprop` or `@cssproperty` |
| `@cssprop` written without the leading dashes (`@cssprop badge-color`) | Listed as an unknown tag; no hook | Write the full name: `--badge-color` |
| Tagged doc block above a rule that declares no property | Block not documented; logged as `doc block not attached` | Move it directly above its declaration, or remove the tags |
| Doc block placed below the declaration | Token not documented (parser only looks above) | Move the block above |

## Verification loop

After writing or editing a component's theme tokens:

1. Run `npm run build` (or whatever generates the docs in your project).
2. Open the component's documentation page.
3. Click the **Theming** tab. If the tab is missing entirely, no tokens were extracted. For a free-standing file, check the `Style files:` build log line and the warnings next to it.
4. Verify the index lists every token you documented.
5. For each token row, check the **Type** and **Default** cells render the expected values; check the description block renders Markdown correctly.
6. Open the collapsible **Source** panel at the bottom. Your raw stylesheet should appear there. If a file you expected is missing, the resolver did not find it.

If something is wrong, the most common causes are listed in the anti-patterns table above.

## Recipe: minimal component theming surface

Copy-paste starting point for a brand-new component. Five tokens, two groups, an overview, and a deprecated alias:

```css
/**
 * @overview
 * Theme tokens for the **{{component-name}}** control. Override in a
 * global stylesheet to retheme every instance.
 */

/**
 * Background fill.
 * @type <color>
 * @default #f8fafc
 * @group container
 */
@property --{{component-prefix}}-bg {
    syntax: '<color>';
    inherits: true;
    initial-value: #f8fafc;
}

/**
 * Text colour.
 * @type <color>
 * @default inherit
 * @group container
 */
@property --{{component-prefix}}-color {
    syntax: '*';
    inherits: true;
    initial-value: inherit;
}

/**
 * Border radius.
 * @type <length>
 * @default 8px
 * @group container
 * @example css
 *   .{{component-prefix}}--sharp { --{{component-prefix}}-radius: 0; }
 */
@property --{{component-prefix}}-radius {
    syntax: '<length>';
    inherits: true;
    initial-value: 8px;
}

/**
 * Icon size (width and height).
 * @type <length>
 * @default 20px
 * @group icon
 * @since 0.1.0
 */
@property --{{component-prefix}}-icon-size {
    syntax: '<length>';
    inherits: true;
    initial-value: 20px;
}

/**
 * @deprecated Use --{{component-prefix}}-color instead.
 */
@property --{{component-prefix}}-text-color {
    syntax: '*';
    inherits: true;
    initial-value: currentColor;
}
```

## Recipe: retrofit an existing stylesheet

You have an existing component CSS with custom properties but no documentation. Convert it incrementally:

```css
/* BEFORE */
:host {
    --acme-alert-bg: #f8fafc;
    --acme-alert-color: inherit;
    --acme-alert-padding: 12px 16px;
    --acme-alert-radius: 8px;
}
```

```css
/* AFTER */
/**
 * @overview
 * Theme tokens for the alert component.
 */
:host {
    /**
     * Background fill of the alert container.
     * @type <color>
     * @default #f8fafc
     * @group container
     */
    --acme-alert-bg: #f8fafc;

    /**
     * Text colour of the alert body.
     * @type <color>
     * @default inherit
     * @group container
     */
    --acme-alert-color: inherit;

    /**
     * Padding of the alert container.
     * @type <length-percentage>+
     * @default 12px 16px
     * @group container
     */
    --acme-alert-padding: 12px 16px;

    /**
     * Corner radius of the alert container.
     * @type <length>
     * @default 8px
     * @group container
     */
    --acme-alert-radius: 8px;
}
```

Migrating to `@property` is a separate, optional step. Do it once the inline-doc retrofit is in place.

## Recipe: common cross-references

```css
/**
 * Severity-specific danger background. Inherits the base
 * `--acme-alert-bg` when not set.
 * @type <color>
 * @default #fee2e2
 * @group severity
 * @see --acme-alert-bg
 * @see https://example.com/docs/alert#danger
 */
@property --acme-alert-danger-bg {
    syntax: '<color>';
    inherits: true;
    initial-value: #fee2e2;
}
```

Token descriptions, `@deprecated` notes and mixin descriptions are Markdown and resolve `{@link}` like the overview: `{@link --acme-alert-bg}` (or `{@link --acme-alert-bg|label}`) links to that token's row on the same page (on `design-tokens.html`, to the row there), and a token without a row on the page renders as code. `@see` entries appear as a comma-separated footer; URLs open in a new tab, token names (`--name`, `$name`) link to their rows.

## What this guide does NOT cover

These are intentionally out of scope. Do not try to document them and expect them to surface:

- CSS `@layer` and `@scope` introspection.
- Transitive `@import` / `@use` resolution beyond one level. Keep token partials a single hop away from the component stylesheet.
- Token usage graphs (which component consumes which token from another component's surface).
- Validation of `@type` against the actual declaration value. The parser trusts you.
- Auto-detection of undocumented tokens. Tokens without a doc block are intentionally invisible, the same convention as undocumented JSDoc on TypeScript members.

## Related references

- `docs/configuration.md` → "Theming Tab" and "Style files" sections: the user-facing reference for the tag set, `styleFiles` and the resolution rules.
- `docs/custom-templates.md` → "Block-level overrides": how to replace the default rendering for the whole panel (`block-theming`), a single row (`block-theming-token`) or a single mixin (`block-theming-mixin`), and the `style` and `design-tokens` pages.
- `src/utils/theme-doc-parser.ts`: the parser itself. Read this if you suspect a parser bug or want to understand an edge case.
- `src/templates/blocks/BlockTheming.tsx`: the renderer. Read this to know exactly which markup ends up in the page.
