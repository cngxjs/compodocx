### CngxActionButton

Action button molecule combining async state tracking, visual feedback, and optional toast notifications.

#### Import

```typescript
import { CngxActionButton } from "@cngx/ui";
```

#### Quick Start

```angular-ts
import { Component } from "@angular/core";
import { CngxActionButton } from "@cngx/ui";

@Component({
    selector: "app-example",
    template: ` <cngx-action-button [action]="save"> Save Draft </cngx-action-button> `,
    imports: [CngxActionButton],
})
export class ExampleComponent {
    save = () => this.http.post("/api/draft", {});
}
```

#### Overview

`CngxActionButton` is a molecule wrapping the `CngxAsyncClick` directive with built-in state communication, template slots, and optional toast integration. It uses `display: contents` — the host produces no DOM box; the inner `<button>` carries the directive directly.

The component supports three visual feedback pathways:

1. **Fallback labels** — `pendingLabel`, `succeededLabel`, `failedLabel` strings
2. **Template slots** — `cngxPending`, `cngxSucceeded`, `cngxFailed` directives
3. **Automatic state prop** — bind `btn.state` to any state consumer

A screen-reader-only `aria-live` region announces state transitions without visual noise.

#### Theming

#### CSS Custom Properties

- `--cngx-action-btn-transition` (`0.2s ease`) — Transition duration and easing
- `--cngx-action-btn-radius` (`6px`) — Border radius
- `--cngx-action-btn-padding` (`8px 16px`) — Padding
- `--cngx-action-btn-border` (`--mat-sys-outline-variant` M3, `#ddd` fallback) — Border color
- `--cngx-action-btn-bg` (transparent) — Default background
- `--cngx-action-btn-pending-opacity` (`0.7`) — Opacity while pending
- `--cngx-action-btn-succeeded-bg` (M3 primary 12%, `#e8f5e9` fallback) — Success state background
- `--cngx-action-btn-succeeded-color` (M3 primary, `#2e7d32` fallback) — Success state text
- `--cngx-action-btn-succeeded-border` (M3 primary, `#2e7d32` fallback) — Success state border
- `--cngx-action-btn-failed-bg` (M3 error 12%, `#ffebee` fallback) — Error state background
- `--cngx-action-btn-failed-color` (M3 error, `#c62828` fallback) — Error state text
- `--cngx-action-btn-failed-border` (M3 error, `#c62828` fallback) — Error state border
- `--cngx-action-btn-primary-bg` (M3 primary, `#1976d2` fallback) — Primary variant background
- `--cngx-action-btn-primary-color` (M3 on-primary, `#fff` fallback) — Primary variant text
- `--cngx-action-btn-secondary-bg` (transparent) — Secondary variant background
- `--cngx-action-btn-secondary-color` (M3 primary, `#1976d2` fallback) — Secondary variant text
- `--cngx-action-btn-secondary-border` (M3 outline, `#79747e` fallback) — Secondary variant border
- `--cngx-action-btn-ghost-color` (M3 on-surface-variant, `#49454f` fallback) — Ghost variant text
- `--cngx-action-btn-ghost-hover-bg` (M3 on-surface 8%, `rgba(0,0,0,0.04)` fallback) — Ghost variant hover background

#### Accessibility

`CngxActionButton` is fully accessible out of the box:

- **ARIA roles:** The inner `<button>` carries all ARIA attributes from `CngxAsyncClick` — `aria-busy` when pending, no explicit role (semantic `<button>`).
- **Keyboard interaction:**
    - `Enter` / `Space` — Activate the action
    - `Escape` — No special behavior (standard button)
- **Screen reader:** `aria-live="polite"` region announces state transitions: "Action succeeded", "Action failed", and the optional custom announcements via `succeededAnnouncement` / `failedAnnouncement`.
- **Focus management:** Focus remains on the button throughout the lifecycle — no focus trap or restoration.

#### Composition

`CngxActionButton` is built from these atomic units and integrates with:

- **Host directives:** Applies `CngxAsyncClick` directly on the inner `<button>` (not exposed as hostDirective).
- **Combines with:** `CngxPending`, `CngxSucceeded`, `CngxFailed` template marker directives; `CngxToaster` for toast integration.
- **Provides:** The `state` signal export for binding to any async state consumer.

##### Example: Composition Pattern

```angular-html
<!-- Bind button state to an alert -->
<cngx-action-button #btn="cngxActionButton" [action]="save">
  Save
</cngx-action-button>
<cngx-alert [state]="btn.state" title="Save Status" />
```

#### Styling

All colors and spacing use CSS Custom Properties with Material 3 defaults. Override at any scope:

```css
/* Override defaults in your component or global styles */
:host {
    --cngx-action-btn-transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --cngx-action-btn-radius: 8px;
    --cngx-action-btn-primary-bg: #1565c0;
    --cngx-action-btn-primary-color: #fff;
}
```

## Examples

### Basic Usage

```angular-html
<!-- Minimal setup — use default variant and labels -->
<cngx-action-button [action]="save">
  Save
</cngx-action-button>
```

### With String Labels

```angular-html
<cngx-action-button
  [action]="save"
  pendingLabel="Saving..."
  succeededLabel="Saved!"
  failedLabel="Save failed — retry?">
  Save
</cngx-action-button>
```

### With Template Slots

```angular-html
<cngx-action-button [action]="save">
  Save Draft
  <ng-template cngxPending>
    <mat-spinner diameter="18" /> Saving...
  </ng-template>
  <ng-template cngxSucceeded>
    Done! Changes saved.
  </ng-template>
  <ng-template cngxFailed let-err>
    Failed: {{ err instanceof Error ? err.message : 'Unknown error' }}
  </ng-template>
</cngx-action-button>
```

### With Toast Feedback

```angular-html
<!-- Requires provideFeedback(withToasts()) or provideToasts() in app config -->
<cngx-action-button
  [action]="save"
  toastSuccess="Document saved"
  toastError="Save failed">
  Save
</cngx-action-button>
```

### With External State

```angular-ts
// Derive button status from a separate async state (e.g., a data source)
@Component({...})
export class MyComponent {
  readonly saveState = injectAsyncState(() => this.http.post('/api/draft', {}));

  save = () => this.saveState.execute(() => this.http.post('/api/draft', {}));
}
```

```angular-html
<!-- In template -->
<cngx-action-button [action]="save" [externalState]="saveState.state">
  Save
</cngx-action-button>
```

### Variants

```angular-html
<cngx-action-button [action]="save" variant="primary">
  Primary Action
</cngx-action-button>

<cngx-action-button [action]="delete" variant="secondary">
  Secondary Action
</cngx-action-button>

<cngx-action-button [action]="expand" variant="ghost">
  Ghost Action
</cngx-action-button>
```

### Accessibility-First: SR Announcements

```angular-html
<cngx-action-button
  [action]="deleteItem"
  succeededAnnouncement="Item deleted successfully"
  failedAnnouncement="Could not delete item">
  Delete
</cngx-action-button>
```

#### Material Theme

To apply Material Design 3 theme colors, include the theme SCSS in your global stylesheet:

```scss
@use "@angular/material" as mat;
@use "@cngx/ui/action-button/action-button-theme" as action-btn;

$theme: mat.define-theme((...));

html {
    @include mat.all-component-themes($theme);
    @include action-btn.theme($theme);
}
```

The theme mixin automatically derives success/error colors from Material's primary and error palettes. Both Material 3 (M3) and Material 2 (M2) are supported; colors adapt to the theme version automatically.
