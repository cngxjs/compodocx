import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { FooterComponent } from './app/footer/footer.component';
import { NoopInterceptor } from './app/shared/interceptors/noopinterceptor.interceptor';

bootstrapApplication(FooterComponent, {
    providers: [provideHttpClient(withInterceptors([NoopInterceptor]))]
});
