import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';

export type ConfirmDialogOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
};

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dialog
      class="m-auto w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-black/40 open:flex open:flex-col open:gap-4"
      (click)="onBackdropClick($event)"
      (close)="onDialogClose()"
    >
      <h2 class="text-base font-semibold text-slate-800">{{ title() }}</h2>
      <p class="text-sm text-slate-600">{{ message() }}</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          (click)="cancel()"
          class="rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          (click)="confirm()"
          class="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
        >
          {{ confirmLabel() }}
        </button>
      </div>
    </dialog>
  `,
})
export class ConfirmDialog {
  protected readonly title = signal('確認');
  protected readonly message = signal('この操作を実行しますか？');
  protected readonly confirmLabel = signal('削除');

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private resolvePromise?: (confirmed: boolean) => void;

  open(options: ConfirmDialogOptions = {}): Promise<boolean> {
    this.title.set(options.title ?? '確認');
    this.message.set(options.message ?? 'この操作を実行しますか？');
    this.confirmLabel.set(options.confirmLabel ?? '削除');
    this.dialogRef().nativeElement.showModal();
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  protected confirm(): void {
    this.dialogRef().nativeElement.close();
    this.resolvePromise?.(true);
    this.resolvePromise = undefined;
  }

  protected cancel(): void {
    this.dialogRef().nativeElement.close();
    this.resolvePromise?.(false);
    this.resolvePromise = undefined;
  }

  protected onBackdropClick(event: MouseEvent): void {
    const rect = this.dialogRef().nativeElement.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (isOutside) {
      this.cancel();
    }
  }

  // Escキーでネイティブに閉じられた場合
  protected onDialogClose(): void {
    this.resolvePromise?.(false);
    this.resolvePromise = undefined;
  }
}
