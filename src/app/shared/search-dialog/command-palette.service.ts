import { Injectable, inject } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { SearchDialogComponent } from './search-dialog.component';

/**
 * Opens the ⌘K / Ctrl+K tool search palette. Centralized here so every
 * entry point (global keyboard shortcut, sidebar search button, landing
 * page) opens the exact same dialog the exact same way.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly dialog = inject(Dialog);

  open(): void {
    // Guard against stacking multiple overlapping palettes when the user
    // presses ⌘K/Ctrl+K (or clicks the search button) more than once.
    if (this.dialog.openDialogs.length > 0) {
      return;
    }

    this.dialog.open(SearchDialogComponent, {
      width: '100%',
      maxWidth: '800px',
      backdropClass: 'cdk-overlay-dark-backdrop',
    });
  }
}
