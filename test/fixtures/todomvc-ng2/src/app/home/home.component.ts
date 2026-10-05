import { Component, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';

import { HeaderComponent } from '../header/header.component';
import { ListComponent } from '../list/list.component';
import { FooterComponent } from '../footer/footer.component';

const selector = 'home';
const template = `
<div class="todoapp">
    <header class="header"></header>
    <list class="main"></list>
    <footer></footer>
</div>
`;
const templateUrl = './home.component.html';
const changeDetection = ChangeDetectionStrategy.OnPush;
const encapsulation = ViewEncapsulation.Emulated;
/**
 * The home component
 */
@Component({
    selector,
    template,
    templateUrl,
    changeDetection,
    encapsulation,
    imports: [HeaderComponent, ListComponent, FooterComponent]
})
export class HomeComponent {
    public showTab() {}
}
