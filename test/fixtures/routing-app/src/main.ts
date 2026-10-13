import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { baseConfig, featureConfig } from './app/app.config';
import { RtaShell } from './app/shell.component';

bootstrapApplication(RtaShell, mergeApplicationConfig(baseConfig, featureConfig)).catch(error =>
    console.error(error)
);
