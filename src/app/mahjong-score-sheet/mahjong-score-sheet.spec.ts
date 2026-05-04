import { TestBed } from '@angular/core/testing';
import { MahjongScoreSheet } from './mahjong-score-sheet';

describe('MahjongScoreSheet', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MahjongScoreSheet],
    }).compileComponents();
  });

  it('符号付き整数文字列から合計100000点を計算できる', () => {
    const fixture = TestBed.createComponent(MahjongScoreSheet);
    const component = fixture.componentInstance as unknown as {
      form: {
        patchValue: (value: { p1: string; p2: string; p3: string; p4: string }) => void;
      };
      totalScore: () => number;
      isTotalValid: () => boolean;
    };

    component.form.patchValue({ p1: '-100', p2: '400', p3: '350', p4: '350' });

    expect(component.totalScore()).toBe(100000);
    expect(component.isTotalValid()).toBe(true);
  });

  it('途中入力の単独マイナスでは合計判定を有効にしない', () => {
    const fixture = TestBed.createComponent(MahjongScoreSheet);
    const component = fixture.componentInstance as unknown as {
      form: {
        patchValue: (value: { p1: string; p2: string; p3: string; p4: string }) => void;
      };
      totalScore: () => number;
      isTotalValid: () => boolean;
    };

    component.form.patchValue({ p1: '-', p2: '250', p3: '250', p4: '250' });

    expect(component.totalScore()).toBe(0);
    expect(component.isTotalValid()).toBe(false);
  });

  it('3席入力時に残り1席を自動補完できる', () => {
    const fixture = TestBed.createComponent(MahjongScoreSheet);
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          p1: { setValue: (value: string) => void; markAsDirty: () => void };
          p2: { setValue: (value: string) => void; markAsDirty: () => void };
          p3: { setValue: (value: string) => void; markAsDirty: () => void };
          p4: { value: string };
        };
      };
      autoFillRemainingScore: () => void;
    };

    component.form.controls.p1.setValue('100');
    component.form.controls.p1.markAsDirty();
    component.form.controls.p2.setValue('200');
    component.form.controls.p2.markAsDirty();
    component.form.controls.p3.setValue('300');
    component.form.controls.p3.markAsDirty();

    component.autoFillRemainingScore();

    expect(component.form.controls.p4.value).toBe('400');
  });
});
