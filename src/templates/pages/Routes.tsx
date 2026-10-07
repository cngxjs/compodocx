import Html from '@kitajs/html';
import { hrefFor, hrefText } from '../../app/links/layout';
import { t } from '../helpers';

type RoutesProps = {
    readonly depth: number;
};

export const Routes = (props: RoutesProps): string => {
    const routesIndex = hrefText(
        hrefFor({ type: 'asset', path: 'js/routes/routes_index.js' }, props.depth)
    );
    return (
        <>
            <ol class="cdx-breadcrumb">
                <li class="">{t('routes')}</li>
            </ol>

            <div id="body-routes"></div>

            <script src={routesIndex}></script>
        </>
    ) as string;
};
