import Html from '@kitajs/html';
import { linkTypeHtml } from '../helpers';

/** Standalone section for providers or viewProviders as 2-column grid table. */
export const ProvidersSection = (props: { title: string; entries: any[] }): string => {
    if (!props.entries?.length) {
        return '';
    }

    const esc = (s: string) =>
        s.replaceAll(
            /[&<>]/g,
            (c: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string
        );

    const nameLink = (name: string): string => {
        const resolved = linkTypeHtml(name);
        return resolved || esc(name);
    };

    /** `provideFoo(withBar(…))`: the callee and each feature function linked. */
    const callHtml = (call: { callee: string; args: readonly string[] }): string => {
        const args = call.args.map(arg => `${nameLink(arg)}(…)`).join(', ');
        return `${nameLink(call.callee)}(${args})`;
    };

    const rows = props.entries.map((entry: any) => {
        const nameHtml = entry.call ? callHtml(entry.call) : nameLink(entry.name);
        const parts: string[] = [];

        if (entry.call) {
            // A provider function call: no DI strategy to label.
        } else if (entry.kind === 'class') {
            parts.push('<span class="cdx-provider-strategy">useClass</span>');
        } else if (entry.kind === 'useClass' && entry.useClass) {
            parts.push(
                `<span class="cdx-provider-strategy">useClass</span> ${nameLink(entry.useClass)}`
            );
        } else if (entry.kind === 'useValue') {
            const val = entry.useValue ?? '';
            parts.push(
                `<span class="cdx-provider-strategy">useValue</span> <code>${esc(val)}</code>`
            );
        } else if (entry.kind === 'useFactory') {
            if (entry.factory) {
                parts.push(
                    `<span class="cdx-provider-strategy">useFactory</span> ${nameLink(entry.factory)}`
                );
            }
            if (entry.deps?.length) {
                parts.push(
                    `<span class="cdx-host-dir-chip">deps: ${entry.deps.map((d: string) => nameLink(d)).join(', ')}</span>`
                );
            }
        } else if (entry.kind === 'useExisting' && entry.useExisting) {
            parts.push(
                `<span class="cdx-provider-strategy">useExisting</span> ${nameLink(entry.useExisting)}`
            );
        }

        if (entry.multi) {
            parts.push('<span class="cdx-host-dir-chip">multi</span>');
        }

        const valueHtml = parts.length > 0 ? parts.join(' ') : '';
        return `<div class="cdx-provider-row"><dt class="cdx-provider-name">${nameHtml}</dt><dd class="cdx-provider-value">${valueHtml}</dd></div>`;
    });

    const headingId = props.title.toLowerCase().replaceAll(/\s+/g, '-');
    return (
        <section class="cdx-content-section" data-compodoc="block-providers">
            <h3 class="cdx-section-heading" id={headingId}>
                {props.title}
                <a class="cdx-member-permalink" href={`#${headingId}`}>
                    #
                </a>
            </h3>
            <dl class="cdx-provider-table">{rows.join('')}</dl>
        </section>
    ) as string;
};
