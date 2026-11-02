import Html from '@kitajs/html';
import { markedAcl } from '../../utils/marked.acl';
import { parseDescription } from '../helpers/parse-description';

export type SlotEntry = { name: string; description: string };

/**
 * Content-slot inventory harvested from `@slot <name> <description>` JSDoc
 * tags on a component or directive.
 *
 * Answers the question a consumer has before they know a slot directive
 * exists: what can I project into this thing. The slot directives
 * themselves are marker directives with no inputs and no outputs, so
 * their own pages carry no API surface to discover this from.
 *
 * Rendered on both `ComponentPage` and `DirectivePage`. Directives host
 * slots just as often as components do - a structural host like an item
 * or a tab is frequently a directive - so gating this on the page kind
 * would hide the inventory for exactly the hosts whose own API tab is
 * emptiest.
 */
export const ContentSlotsSection = (slots: SlotEntry[] | undefined, depth: number): string => {
    if (!slots || slots.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            <h3 class="cdx-section-heading" id="content-slots">
                Content Slots
                <a class="cdx-member-permalink" href="#content-slots">
                    #
                </a>
            </h3>
            <dl class="cdx-metadata-card">
                {slots.map(slot => (
                    <div class="cdx-metadata-row" data-cdx-slot={slot.name}>
                        <dt class="cdx-metadata-label">{Html.escapeHtml(slot.name)}</dt>
                        <dd class="cdx-metadata-value">
                            {/* one span: the value is a flex row, the text must flow as one item */}
                            <span class="cdx-prose">
                                {parseDescription(
                                    markedAcl.parseInline(slot.description) as string,
                                    depth
                                )}
                            </span>
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    ) as string;
};
