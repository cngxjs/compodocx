import { FormsModule } from '@angular/forms';

export const HeaderComponentSchema = {
    selector: 'header',
    providers: [],
    templateUrl: './header.component.html',
    imports: [FormsModule],
    styles: [
        `h1 {
    margin-top: 75px;
}`
    ]
};
