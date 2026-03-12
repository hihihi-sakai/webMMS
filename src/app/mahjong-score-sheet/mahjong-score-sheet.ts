import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  input,
  output
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';

type UmaPreset = {
  id: string;
  label: string;
  values: [number, number, number, number];
};

type OkaPreset = {
  id: string;
  label: string;
  returnPoint: number;
};

type TieModePreset = {
  id: 'dealer-priority' | 'split';
  label: string;
};

type RegisteredPlayer = {
  id: string;
  name: string;
};

type PlayerResult = {
  seat: 1 | 2 | 3 | 4;
  playerId: string;
  name: string;
  score: number;
  rank: number;
  base: number;
  uma: number;
  oka: number;
  total: number;
};

export type ScoreSheetResult = PlayerResult;

type SavedSettings = {
  umaPreset: string;
  okaPreset: string;
  tieMode: string;
};

@Component({
  selector: 'app-mahjong-score-sheet',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mahjong-score-sheet.html',
  styleUrl: './mahjong-score-sheet.css'
})
export class MahjongScoreSheet {
  private static readonly START_POINT = 25000;
  private static readonly INPUT_UNIT = 100;
  private static readonly TOTAL_INPUT_UNIT = 1000;
  private static readonly SETTINGS_STORAGE_KEY = 'mahjong-score-sheet-settings';
  private static readonly PLAYER_STORAGE_KEY = 'mahjong-aggregate-players';
  private static readonly MAX_PLAYERS = 8;
  private lastResetToken: number | null = null;
  private lastSelectedPlayerIds: [string, string, string, string] = ['', '', '', ''];
  protected readonly startPoint = MahjongScoreSheet.START_POINT;
  protected readonly registeredPlayers = signal<RegisteredPlayer[]>(this.loadPlayersFromStorage());

  protected readonly umaPresets: UmaPreset[] = [
    { id: '10-20', label: '10-20', values: [20, 10, -10, -20] },
    { id: '5-10', label: '5-10', values: [10, 5, -5, -10] },
    { id: 'none', label: 'なし', values: [0, 0, 0, 0] }
  ];

  protected readonly okaPresets: OkaPreset[] = [
    { id: '20', label: '20 (返し点 30000)', returnPoint: 30000 },
    { id: '10', label: '10 (返し点 27500)', returnPoint: 27500 },
    { id: '0', label: 'なし (返し点 25000)', returnPoint: 25000 }
  ];

  protected readonly tieModePresets: TieModePreset[] = [
    { id: 'dealer-priority', label: '起家優先' },
    { id: 'split', label: '折半' }
  ];

  protected readonly form;
  protected readonly values;
  readonly totalChange = output<number>();
  readonly resultsChange = output<ScoreSheetResult[]>();
  readonly isScoreTotalValidChange = output<boolean>();
  readonly useFrameStyle = input(true);
  readonly resetToken = input(0);
  readonly playerSyncToken = input(0);
  readonly player1 = input('プレイヤー1');
  readonly player2 = input('プレイヤー2');
  readonly player3 = input('プレイヤー3');
  readonly player4 = input('プレイヤー4');

  protected readonly selectedPlayerIds = computed<[string, string, string, string]>(() => {
    const value = this.values();
    return [value.player1Id, value.player2Id, value.player3Id, value.player4Id];
  });

  protected readonly playerNames = computed<[string, string, string, string]>(
    () => {
      if (this.registeredPlayers().length < 4) {
        return [
          this.normalizePlayerName(this.player1(), 'プレイヤー1'),
          this.normalizePlayerName(this.player2(), 'プレイヤー2'),
          this.normalizePlayerName(this.player3(), 'プレイヤー3'),
          this.normalizePlayerName(this.player4(), 'プレイヤー4')
        ];
      }

      const [player1Id, player2Id, player3Id, player4Id] = this.selectedPlayerIds();
      return [
        this.getRegisteredPlayerNameById(player1Id, 'プレイヤー1'),
        this.getRegisteredPlayerNameById(player2Id, 'プレイヤー2'),
        this.getRegisteredPlayerNameById(player3Id, 'プレイヤー3'),
        this.getRegisteredPlayerNameById(player4Id, 'プレイヤー4')
      ];
    }
  );

  protected readonly totalScore = computed(() => {
    const value = this.values();
    return (value.p1 + value.p2 + value.p3 + value.p4) * MahjongScoreSheet.INPUT_UNIT;
  });

  protected readonly isTotalValid = computed(() => this.totalScore() === 100000);

  protected readonly selectedOka = computed(
    () =>
      this.okaPresets.find((preset) => preset.id === this.values().okaPreset) ??
      this.okaPresets[0]
  );

  protected readonly selectedUma = computed(
    () =>
      this.umaPresets.find((preset) => preset.id === this.values().umaPreset) ??
      this.umaPresets[0]
  );

  protected readonly selectedTieMode = computed(
    () =>
      this.tieModePresets.find((preset) => preset.id === this.values().tieMode) ??
      this.tieModePresets[0]
  );

  protected readonly returnPoint = computed(() => this.selectedOka().returnPoint);

  protected readonly okaValue = computed(() =>
    (this.selectedOka().returnPoint - MahjongScoreSheet.START_POINT) * 4 / 1000
  );

  protected readonly convertedTotal = computed(() =>
    this.results().reduce((sum, result) => sum + result.total, 0)
  );

  protected readonly results = computed<PlayerResult[]>(() => {
    const value = this.values();
    const selectedUma = this.selectedUma();
    const selectedOka = this.selectedOka();

    const players = [
      {
        seat: 1 as const,
        playerId: value.player1Id,
        name: this.playerNames()[0],
        score: value.p1 * MahjongScoreSheet.INPUT_UNIT
      },
      {
        seat: 2 as const,
        playerId: value.player2Id,
        name: this.playerNames()[1],
        score: value.p2 * MahjongScoreSheet.INPUT_UNIT
      },
      {
        seat: 3 as const,
        playerId: value.player3Id,
        name: this.playerNames()[2],
        score: value.p3 * MahjongScoreSheet.INPUT_UNIT
      },
      {
        seat: 4 as const,
        playerId: value.player4Id,
        name: this.playerNames()[3],
        score: value.p4 * MahjongScoreSheet.INPUT_UNIT
      }
    ];

    const ranked = [...players]
      .map((player, index) => ({ ...player, index }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const provisional: Array<PlayerResult & { sortIndex: number }> = [];

    if (this.selectedTieMode().id === 'dealer-priority') {
      ranked.forEach((player, rankIndex) => {
        const rank = rankIndex + 1;
        const baseRaw = (player.score - selectedOka.returnPoint) / 1000;
        const uma = selectedUma.values[rank - 1] ?? 0;
        const oka = rank === 1 ? this.okaValue() : 0;
        const rawTotal = baseRaw + uma + oka;

        provisional.push({
          seat: player.seat,
          playerId: player.playerId,
          name: player.name,
          score: player.score,
          rank,
          base: this.roundToOneDecimal(baseRaw),
          uma,
          oka,
          total: this.roundByGoshaRokunyu(rawTotal),
          sortIndex: rankIndex
        });
      });
    } else {
      let cursor = 0;

      while (cursor < ranked.length) {
        const groupScore = ranked[cursor].score;
        let end = cursor;
        while (end + 1 < ranked.length && ranked[end + 1].score === groupScore) {
          end += 1;
        }

        const group = ranked.slice(cursor, end + 1);
        const groupSize = group.length;
        const startRank = cursor + 1;
        const endRank = end + 1;

        let umaTotal = 0;
        for (let rank = startRank; rank <= endRank; rank += 1) {
          umaTotal += selectedUma.values[rank - 1] ?? 0;
        }

        const sharedUma = umaTotal / groupSize;
        const sharedOka = startRank === 1 ? this.okaValue() / groupSize : 0;

        group.forEach((player, indexInGroup) => {
          const baseRaw = (player.score - selectedOka.returnPoint) / 1000;
          const rawTotal = baseRaw + sharedUma + sharedOka;

          provisional.push({
            seat: player.seat,
            playerId: player.playerId,
            name: player.name,
            score: player.score,
            rank: startRank,
            base: this.roundToOneDecimal(baseRaw),
            uma: sharedUma,
            oka: sharedOka,
            total: this.roundByGoshaRokunyu(rawTotal),
            sortIndex: cursor + indexInGroup
          });
        });

        cursor = end + 1;
      }
    }

    const roundedSum = provisional.reduce((sum, result) => sum + result.total, 0);
    const carryToTop = -roundedSum;

    return provisional
      .map((result) => ({
        ...result,
        total: result.sortIndex === 0 ? result.total + carryToTop : result.total
      }))
      .sort((a, b) => a.rank - b.rank || a.sortIndex - b.sortIndex)
      .map(({ sortIndex, ...result }) => result);
  });

  public constructor(private readonly fb: FormBuilder) {
    const savedSettings = this.loadSavedSettings();
    const defaultPlayerSelection = this.createDefaultPlayerSelection(
      this.registeredPlayers().map((player) => player.id)
    );

    this.form = this.fb.nonNullable.group({
      umaPreset: [savedSettings?.umaPreset ?? '10-20'],
      okaPreset: [savedSettings?.okaPreset ?? '20'],
      tieMode: [savedSettings?.tieMode ?? 'dealer-priority'],
      player1Id: [defaultPlayerSelection[0]],
      player2Id: [defaultPlayerSelection[1]],
      player3Id: [defaultPlayerSelection[2]],
      player4Id: [defaultPlayerSelection[3]],
      p1: [250, [Validators.required, Validators.min(0)]],
      p2: [250, [Validators.required, Validators.min(0)]],
      p3: [250, [Validators.required, Validators.min(0)]],
      p4: [250, [Validators.required, Validators.min(0)]]
    });

    const initial = this.form.getRawValue();
    this.lastSelectedPlayerIds = [
      initial.player1Id,
      initial.player2Id,
      initial.player3Id,
      initial.player4Id
    ];

    this.values = toSignal(
      this.form.valueChanges.pipe(
        startWith(this.form.getRawValue()),
        map(() => this.form.getRawValue())
      ),
      { initialValue: this.form.getRawValue() }
    );

    effect(() => {
      const { umaPreset, okaPreset, tieMode } = this.values();
      this.saveSettings({ umaPreset, okaPreset, tieMode });
    });

    effect(() => {
      this.totalChange.emit(this.convertedTotal());
    });

    effect(() => {
      this.isScoreTotalValidChange.emit(this.isTotalValid());
    });

    effect(() => {
      this.resultsChange.emit(this.results());
    });

    effect(() => {
      this.values();
      this.autoFillRemainingScore();
    });

    effect(() => {
      const token = this.resetToken();

      if (this.lastResetToken === null) {
        this.lastResetToken = token;
        return;
      }

      if (token === this.lastResetToken) {
        return;
      }

      this.lastResetToken = token;
      this.resetScoresOnly();
    });

    effect(() => {
      this.playerSyncToken();
      const refreshedPlayers = this.loadPlayersFromStorage();
      this.registeredPlayers.set(refreshedPlayers);

      const defaults = this.createDefaultPlayerSelection(
        refreshedPlayers.map((player) => player.id)
      );
      const current = this.form.getRawValue();

      const nextPlayer1 = refreshedPlayers.some((player) => player.id === current.player1Id)
        ? current.player1Id
        : defaults[0];
      const nextPlayer2 = refreshedPlayers.some((player) => player.id === current.player2Id)
        ? current.player2Id
        : defaults[1];
      const nextPlayer3 = refreshedPlayers.some((player) => player.id === current.player3Id)
        ? current.player3Id
        : defaults[2];
      const nextPlayer4 = refreshedPlayers.some((player) => player.id === current.player4Id)
        ? current.player4Id
        : defaults[3];

      if (
        current.player1Id === nextPlayer1 &&
        current.player2Id === nextPlayer2 &&
        current.player3Id === nextPlayer3 &&
        current.player4Id === nextPlayer4
      ) {
        this.lastSelectedPlayerIds = [
          current.player1Id,
          current.player2Id,
          current.player3Id,
          current.player4Id
        ];
        return;
      }

      this.form.patchValue({
        player1Id: nextPlayer1,
        player2Id: nextPlayer2,
        player3Id: nextPlayer3,
        player4Id: nextPlayer4
      });

      this.lastSelectedPlayerIds = [
        nextPlayer1,
        nextPlayer2,
        nextPlayer3,
        nextPlayer4
      ];
    });
  }

  protected formatPoint(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  protected formatBasePoint(value: number): string {
    return value.toFixed(1);
  }

  protected onPlayerSeatChange(seat: 1 | 2 | 3 | 4, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const selectedPlayerId = target.value;
    const previous = this.lastSelectedPlayerIds;
    const seatKeys = ['player1Id', 'player2Id', 'player3Id', 'player4Id'] as const;
    const seatIndex = seat - 1;
    const sourceKey = seatKeys[seatIndex];
    const sourcePlayerId = previous[seatIndex];

    if (selectedPlayerId === sourcePlayerId) {
      return;
    }

    const targetIndex = previous.findIndex(
      (playerId, index) => index !== seatIndex && playerId === selectedPlayerId
    );

    const updates: Partial<Record<(typeof seatKeys)[number], string>> = {
      [sourceKey]: selectedPlayerId
    };

    if (targetIndex !== -1) {
      const targetKey = seatKeys[targetIndex];
      updates[targetKey] = sourcePlayerId;
    }

    this.form.patchValue(updates);

    const current = this.form.getRawValue();
    this.lastSelectedPlayerIds = [
      current.player1Id,
      current.player2Id,
      current.player3Id,
      current.player4Id
    ];
  }

  private roundByGoshaRokunyu(value: number): number {
    const sign = Math.sign(value);
    const abs = Math.abs(value);
    const intPart = Math.floor(abs);
    const fraction = abs - intPart;
    const roundedAbs = fraction >= 0.6 ? intPart + 1 : intPart;

    return sign * roundedAbs;
  }

  private roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private normalizePlayerName(value: string, fallback: string): string {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  private getRegisteredPlayerNameById(playerId: string, fallback: string): string {
    const found = this.registeredPlayers().find((player) => player.id === playerId);
    return found ? this.normalizePlayerName(found.name, fallback) : fallback;
  }

  private createDefaultPlayerSelection(playerIds: string[]): [string, string, string, string] {
    const fallback = playerIds[0] ?? '';
    const first = playerIds[0] ?? fallback;
    const second = playerIds[1] ?? fallback;
    const third = playerIds[2] ?? fallback;
    const fourth = playerIds[3] ?? fallback;
    return [first, second, third, fourth];
  }

  private loadPlayersFromStorage(): RegisteredPlayer[] {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return this.createDefaultPlayers();
    }

    try {
      const raw = localStorageRef.getItem(MahjongScoreSheet.PLAYER_STORAGE_KEY);
      if (!raw) {
        return this.createDefaultPlayers();
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return this.createDefaultPlayers();
      }

      const restored = parsed
        .filter((item): item is Partial<RegisteredPlayer> =>
          typeof item === 'object' && item !== null
        )
        .map((item) => ({
          id: typeof item.id === 'string' ? item.id : '',
          name: typeof item.name === 'string' ? item.name : ''
        }))
        .filter((item) => /^p[1-8]$/.test(item.id))
        .slice(0, MahjongScoreSheet.MAX_PLAYERS)
        .map((item) => ({
          id: item.id,
          name: item.name.slice(0, 7)
        }));

      const unique = new Map<string, RegisteredPlayer>();
      for (const player of restored) {
        if (!unique.has(player.id)) {
          unique.set(player.id, player);
        }
      }

      const uniquePlayers = [...unique.values()].sort((a, b) =>
        this.playerIdToNumber(a.id) - this.playerIdToNumber(b.id)
      );

      if (uniquePlayers.length < 4) {
        return this.createDefaultPlayers();
      }

      return uniquePlayers;
    } catch {
      return this.createDefaultPlayers();
    }
  }

  private createDefaultPlayers(): RegisteredPlayer[] {
    return [
      { id: 'p1', name: 'プレイヤー1' },
      { id: 'p2', name: 'プレイヤー2' },
      { id: 'p3', name: 'プレイヤー3' },
      { id: 'p4', name: 'プレイヤー4' }
    ];
  }

  private playerIdToNumber(playerId: string): number {
    return Number.parseInt(playerId.replace('p', ''), 10);
  }

  private resetScoresOnly(): void {
    this.form.patchValue({
      p1: 250,
      p2: 250,
      p3: 250,
      p4: 250
    });

    this.form.controls.p1.markAsPristine();
    this.form.controls.p2.markAsPristine();
    this.form.controls.p3.markAsPristine();
    this.form.controls.p4.markAsPristine();
  }

  private autoFillRemainingScore(): void {
    const controls = [
      this.form.controls.p1,
      this.form.controls.p2,
      this.form.controls.p3,
      this.form.controls.p4
    ];

    const dirtyControls = controls.filter((control) => control.dirty);
    if (dirtyControls.length !== 3) {
      return;
    }

    const pristineControls = controls.filter((control) => !control.dirty);
    if (pristineControls.length !== 1) {
      return;
    }

    const dirtySum = dirtyControls.reduce((sum, control) => sum + control.value, 0);
    const autoValue = MahjongScoreSheet.TOTAL_INPUT_UNIT - dirtySum;
    const targetControl = pristineControls[0];

    if (targetControl.value === autoValue) {
      return;
    }

    targetControl.setValue(autoValue);
  }

  private loadSavedSettings(): SavedSettings | null {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return null;
    }

    try {
      const raw = localStorageRef.getItem(
        MahjongScoreSheet.SETTINGS_STORAGE_KEY
      );

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<SavedSettings>;
      const isUmaValid = this.umaPresets.some(
        (preset) => preset.id === parsed.umaPreset
      );
      const isOkaValid = this.okaPresets.some(
        (preset) => preset.id === parsed.okaPreset
      );
      const isTieModeValid = this.tieModePresets.some(
        (preset) => preset.id === parsed.tieMode
      );

      if (!isUmaValid || !isOkaValid || !isTieModeValid) {
        return null;
      }

      return {
        umaPreset: parsed.umaPreset ?? '10-20',
        okaPreset: parsed.okaPreset ?? '20',
        tieMode: parsed.tieMode ?? 'dealer-priority'
      };
    } catch {
      return null;
    }
  }

  private saveSettings(settings: SavedSettings): void {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return;
    }

    try {
      localStorageRef.setItem(
        MahjongScoreSheet.SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );
    } catch {
      // Ignore write failures (e.g. private mode/quota exceeded).
    }
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  }
}
