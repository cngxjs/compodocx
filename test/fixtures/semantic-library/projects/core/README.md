# core

Shared building blocks for the semantic library: the foo providers, the select parts and the design tokens.

## Usage

**Parts.** The select entry point ships the listbox, the trigger, the panel and the chips; the tokens entry point ships the colour and spacing tokens they read.

**Modality.** Panels open modal on narrow screens and anchored on wide ones; both close on Escape and return focus to the trigger.

## Behaviour

- **Focus.** Focus moves into the panel when it opens and back to the trigger when it closes.
- **Announcements.** Selection changes are announced through a polite live region.
- **Close vectors.** Escape, a click outside the panel and the back gesture all close it.

## Browser support

<!-- compodocx: inline -->
- Chrome 125+
- Firefox 131+
- Safari 18.4+
