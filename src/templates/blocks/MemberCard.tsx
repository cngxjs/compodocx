import Html from '@kitajs/html';

type MemberCardProps = {
    readonly id: string;
    readonly deprecated?: boolean;
    readonly header: string;
    readonly children: string;
};

/**
 * Thin wrapper for member card chrome.
 *
 * Renders `<article class="cdx-member-card">` with a flat layout (header
 * + body). Previously supported a `collapsible` variant that wrapped the
 * card in `<details>/<summary>` for methods and host listeners, but the
 * collapse toggle was removed - the API tab now renders every card
 * expanded so readers can scan the full member surface without clicking.
 */
export function MemberCard({ id, deprecated, header, children }: MemberCardProps): string {
    const cardClass = deprecated
        ? 'cdx-member-card cdx-member-card--deprecated'
        : 'cdx-member-card';

    return (
        <article class={cardClass} id={id}>
            {header}
            <div class="cdx-member-body">{children}</div>
        </article>
    ) as string;
}
