import { Component } from '@angular/core';
import { provideFooAt, provideFooLimit, withMode } from '@sem/core';

/** A panel that configures foo for its subtree. */
@Component({
    selector: 'sem-foo-panel',
    template: '<ng-content />',
    providers: [provideFooAt(withMode('wide')), provideFooLimit()]
})
export class SemFooPanel {}
