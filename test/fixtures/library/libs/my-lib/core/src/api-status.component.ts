import { Component, input } from '@angular/core';

/**
 * Renders a small badge that reflects the current API connection status.
 *
 * Used as a regression fixture for class-level JSDoc tag rendering — the
 * `@example`, `@since`, and `@category` blocks below MUST appear in the
 * generated docs. Until 0.0.5 they were silently dropped because the
 * component dep-factory used a stale `IO.jsdoctags[0].tags` accessor that
 * always evaluated to `undefined`.
 *
 * <example-url>http://localhost:4200/#/common/a11y/focus-trap</example-url>
 *
 * @example
 * <my-lib-api-status [endpoint]="'/api/health'"></my-lib-api-status>
 *
 * @since 0.0.5
 * @category core
 */
@Component({
    selector: 'my-lib-api-status',
    template: '<span class="api-status">{{ endpoint() }}</span>'
})
export class ApiStatusComponent {
    endpoint = input('/api');
}
