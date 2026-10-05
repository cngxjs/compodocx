import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
    imports: [ReactiveFormsModule],
    template: '<form [formGroup]="userform"></form>'
})
export class ValidationDemo implements OnInit {
    private fb = inject(FormBuilder);

    userform: FormGroup;

    ngOnInit() {
        this.userform = this.fb.group({
            firstname: new FormControl('', Validators.required)
        });
    }
}
