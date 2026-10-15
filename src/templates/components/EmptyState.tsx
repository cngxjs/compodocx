import Html from '@kitajs/html';
export type EmptyStateVariant = 'compact' | 'full' | 'page';

interface EmptyStateProps {
    icon: string;
    title: string;
    description?: string;
    action?: { label: string; href: string };
    variant: EmptyStateVariant;
}

/**
 * Shared empty state component - renders server-side, no client JS.
 *
 * - compact: inline row for member sections (no inputs, no methods)
 * - full: centered column for empty tabs, empty index listings
 * - page: large centered block for bare entity pages, overview with no data
 */
export function EmptyState({ icon, title, description, action, variant }: EmptyStateProps): string {
    if (variant === 'compact') {
        return (
            <div class="cdx-empty-state cdx-empty-state--compact">
                {icon}
                <span>{title}</span>
            </div>
        ) as string;
    }

    const isPage = variant === 'page';
    const variantClass = isPage ? 'cdx-empty-state--page' : 'cdx-empty-state--full';

    return (
        <div class={`cdx-empty-state ${variantClass}`}>
            {icon}
            <p class="cdx-empty-state-title">{title}</p>
            {description && <p class="cdx-empty-state-description">{description}</p>}
            {action && (
                <a class="cdx-empty-state-action" href={action.href}>
                    {action.label}
                </a>
            )}
        </div>
    ) as string;
}
