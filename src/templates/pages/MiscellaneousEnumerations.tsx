import Html from '@kitajs/html';
import { BlockEnum } from '../blocks/BlockEnum';
import { IndexMisc } from '../blocks/IndexMisc';
import { MiscHero } from '../blocks/MiscHero';
import { TaggedDetailLinks } from '../blocks/TaggedDetailLinks';
import { shortPath } from '../helpers';

type MiscEnumerationsProps = {
    readonly miscellaneous: {
        readonly enumerations: any[];
        readonly groupedEnumerations: Record<string, any[]>;
    };
    readonly depth?: number;
};

export const MiscellaneousEnumerations = (props: MiscEnumerationsProps): string =>
    (
        <>
            {MiscHero({ kind: 'enum', count: props.miscellaneous.enumerations.length })}
            {IndexMisc({ list: props.miscellaneous.enumerations, kind: 'enum' })}
            {Object.entries(props.miscellaneous.groupedEnumerations).map(([key, enums]) => (
                <div class="cdx-content-section">
                    <h3 class="cdx-section-heading" title={key}>
                        {shortPath(key)}
                    </h3>
                    {TaggedDetailLinks({
                        items: enums as any[],
                        kind: 'enumeration',
                        depth: props.depth
                    })}
                    {BlockEnum({ enums, depth: props.depth })}
                </div>
            ))}
        </>
    ) as string;
