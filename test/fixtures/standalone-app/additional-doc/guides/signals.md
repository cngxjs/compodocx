# Signals & Reactivity

Child page nested under `Guides` in the summary tree.

## Writable signals

Create one with `signal()` and update it with `set()` or `update()`.

### Computed signals

Derived values recompute lazily when a dependency changes.

#### Equality

A custom `equal` function skips updates for equal values.

##### Notes

Effects run after change detection.
