import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import {
  MahjongScoreSheet,
  ScoreSheetResult
} from '../mahjong-score-sheet/mahjong-score-sheet';

type RegisteredPlayer = {
  id: string;
  name: string;
};

type HalfGameRow = {
  playerId: string;
  score: number;
};

type HalfGameRecord = {
  id: number;
  rows: [HalfGameRow, HalfGameRow, HalfGameRow, HalfGameRow];
};

type AggregateRow = {
  playerId: string;
  name: string;
  games: number;
  total: number;
  average: number;
  finalRevenue: number;
};

@Component({
  selector: 'app-mahjong-aggregate-sheet',
  imports: [ReactiveFormsModule, FormsModule, MahjongScoreSheet, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mahjong-aggregate-sheet.html',
  styleUrl: './mahjong-aggregate-sheet.css'
})
export class MahjongAggregateSheet {
  private static readonly MAX_PLAYERS = 8;
  private static readonly PLAYER_STORAGE_KEY = 'mahjong-aggregate-players';
  private static readonly RECORDS_STORAGE_KEY = 'mahjong-aggregate-records';

  private readonly confirmDialog = viewChild.required(ConfirmDialog);

  protected readonly players = signal<RegisteredPlayer[]>(
    this.loadPlayersFromStorage()
  );

  protected readonly records = signal<HalfGameRecord[]>(
    this.loadRecordsFromStorage()
  );
  protected readonly playerNameErrors = signal<Map<string, string>>(new Map());
  protected readonly selectedPointValue = signal<1 | 2 | 3 | 5 | 10>(1);
  protected readonly playerSyncToken = signal(0);

  private readonly pointValueMap = new Map<1 | 2 | 3 | 5 | 10, number>([
    [1, 10],
    [2, 20],
    [3, 30],
    [5, 50],
    [10, 100]
  ]);
  protected readonly currentHalfGameTotal = signal(0);
  protected readonly currentHalfGameResults = signal<ScoreSheetResult[]>([]);
  protected readonly currentScoreTotalValid = signal(false);
  protected readonly scoreSheetResetToken = signal(0);

  private nextRecordId = this.calcNextRecordId();

  protected readonly canAddPlayer = computed(
    () => this.players().length < MahjongAggregateSheet.MAX_PLAYERS
  );

  protected readonly isEntryPlayerSetValid = computed(() => {
    const results = this.currentHalfGameResults();
    if (results.length !== 4) {
      return false;
    }

    const playerIds = results.map((result) => result.playerId);
    const playerIdSet = new Set(this.players().map((player) => player.id));
    const uniqueSelected = new Set(playerIds);

    return playerIds.every((id) => playerIdSet.has(id)) && uniqueSelected.size === 4;
  });

  protected readonly entryTotal = computed(() => this.currentHalfGameTotal());

  protected readonly canAddRecord = computed(
    () =>
      this.isEntryPlayerSetValid() &&
        this.currentScoreTotalValid() &&
      this.currentHalfGameResults().length === 4
  );

  protected readonly aggregateRows = computed<AggregateRow[]>(() => {
    const playerMap = new Map(
      this.players().map((player) => [
        player.id,
        { playerId: player.id, name: this.normalizeName(player.name), games: 0, total: 0, finalRevenue: 0 }
      ])
    );

    for (const record of this.records()) {
      for (const row of record.rows) {
        const current = playerMap.get(row.playerId);
        if (!current) {
          continue;
        }

        current.games += 1;
        current.total += row.score;
      }
    }

    const pointValue = this.selectedPointValue();
    const moneyPerPoint = this.pointValueMap.get(pointValue) ?? 10;
    return [...playerMap.values()]
      .map((row) => ({
        ...row,
        average: row.games > 0 ? row.total / row.games : 0,
        finalRevenue: row.total * moneyPerPoint
      }))
      .sort((a, b) => b.total - a.total);
  });

  public constructor() {
    effect(() => {
      this.savePlayersToStorage(this.players());
    });

    effect(() => {
      this.saveRecordsToStorage(this.records());
    });

    effect(() => {
      this.players();
      this.playerSyncToken.update((value) => value + 1);
    });
  }

  protected addPlayer(): void {
    if (!this.canAddPlayer()) {
      return;
    }

    const playerNumber = this.findNextAvailablePlayerNumber();
    if (!playerNumber) {
      return;
    }

    this.players.update((current) => [
      ...current,
      {
        id: `p${playerNumber}`,
        name: `プレイヤー${playerNumber}`
      }
    ]);
  }

  protected updatePlayerName(playerId: string, value: string): void {
    this.players.update((current) =>
      current.map((player) =>
        player.id === playerId
          ? { ...player, name: this.trimToLength(value, 7) }
          : player
      )
    );
  }

  protected onPlayerNameInput(playerId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const newName = target.value.trim();
    const isDuplicate = this.players().some(
      (player) => player.id !== playerId && player.name.trim() === newName && newName !== ''
    );

    if (isDuplicate) {
      this.playerNameErrors.update((errors) => {
        const next = new Map(errors);
        next.set(playerId, `「${newName}」は既に使われています`);
        return next;
      });
      return;
    }

    this.playerNameErrors.update((errors) => {
      if (!errors.has(playerId)) return errors;
      const next = new Map(errors);
      next.delete(playerId);
      return next;
    });
    this.updatePlayerName(playerId, target.value);
  }

  protected addRecord(): void {
    if (!this.canAddRecord()) {
      return;
    }

    const rowsBySeat = new Map(
      this.currentHalfGameResults().map((result) => [
        result.seat,
        { playerId: result.playerId, score: result.total }
      ])
    );

    const seat1 = rowsBySeat.get(1);
    const seat2 = rowsBySeat.get(2);
    const seat3 = rowsBySeat.get(3);
    const seat4 = rowsBySeat.get(4);

    if (!seat1 || !seat2 || !seat3 || !seat4) {
      return;
    }

    const record: HalfGameRecord = {
      id: this.nextRecordId,
      rows: [
        seat1,
        seat2,
        seat3,
        seat4
      ]
    };

    this.nextRecordId += 1;
    this.records.update((current) => [record, ...current]);
    this.scoreSheetResetToken.update((value) => value + 1);
  }

  protected onHalfGameTotalChange(total: number): void {
    this.currentHalfGameTotal.set(total);
  }

  protected onHalfGameResultsChange(results: ScoreSheetResult[]): void {
    this.currentHalfGameResults.set(results);
  }

  protected onScoreTotalValidChange(isValid: boolean): void {
    this.currentScoreTotalValid.set(isValid);
  }

  protected getPlayerName(playerId: string): string {
    const found = this.players().find((player) => player.id === playerId);
    return found ? this.normalizeName(found.name) : '未登録';
  }

  protected formatPoint(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }

  protected async clearRecords(): Promise<void> {
    const confirmed = await this.confirmDialog().open({
      title: '累計クリア',
      message: '全ての半荘履歴を削除します。この操作は取り消せません。',
      confirmLabel: 'クリア'
    });
    if (!confirmed) {
      return;
    }
    this.records.set([]);
  }

  protected async deleteRecord(recordId: number): Promise<void> {
    const confirmed = await this.confirmDialog().open({
      title: `第${recordId}半荘を削除`,
      message: 'この半荘の記録を削除します。この操作は取り消せません。',
      confirmLabel: '削除'
    });
    if (!confirmed) {
      return;
    }
    this.records.update((current) => current.filter((r) => r.id !== recordId));
  }

  protected onPointValueChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const value = parseInt(target.value, 10);
    if ([1, 2, 3, 5, 10].includes(value)) {
      this.selectedPointValue.set(value as 1 | 2 | 3 | 5 | 10);
    }
  }

  private normalizeName(value: string): string {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : '名称未設定';
  }

  private trimToLength(value: string, maxLength: number): string {
    return value.slice(0, maxLength);
  }

  private calcNextRecordId(): number {
    const records = this.loadRecordsFromStorage();
    if (records.length === 0) return 1;
    return Math.max(...records.map((r) => r.id)) + 1;
  }

  private loadRecordsFromStorage(): HalfGameRecord[] {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return [];
    }

    try {
      const raw = localStorageRef.getItem(MahjongAggregateSheet.RECORDS_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];

      const restored: HalfGameRecord[] = [];
      for (const item of parsed) {
        if (typeof item !== 'object' || item === null) continue;
        const { id, rows } = item as Record<string, unknown>;
        if (typeof id !== 'number' || !Array.isArray(rows) || rows.length !== 4) continue;
        const parsedRows = rows.map((row) => {
          if (typeof row !== 'object' || row === null) return null;
          const { playerId, score } = row as Record<string, unknown>;
          if (typeof playerId !== 'string' || typeof score !== 'number') return null;
          if (!/^p[1-8]$/.test(playerId)) return null;
          return { playerId, score };
        });
        if (parsedRows.some((r) => r === null)) continue;
        restored.push({ id, rows: parsedRows as [HalfGameRow, HalfGameRow, HalfGameRow, HalfGameRow] });
      }
      return restored;
    } catch {
      return [];
    }
  }

  private saveRecordsToStorage(records: HalfGameRecord[]): void {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) return;
    try {
      localStorageRef.setItem(
        MahjongAggregateSheet.RECORDS_STORAGE_KEY,
        JSON.stringify(records)
      );
    } catch {
      // Ignore write failures.
    }
  }

  private loadPlayersFromStorage(): RegisteredPlayer[] {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return this.createDefaultPlayers();
    }

    try {
      const raw = localStorageRef.getItem(MahjongAggregateSheet.PLAYER_STORAGE_KEY);
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
        .slice(0, MahjongAggregateSheet.MAX_PLAYERS)
        .map((item) => ({
          id: item.id,
          name: this.trimToLength(item.name, 7)
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

  private savePlayersToStorage(players: RegisteredPlayer[]): void {
    const localStorageRef = this.getLocalStorage();
    if (!localStorageRef) {
      return;
    }

    try {
      localStorageRef.setItem(
        MahjongAggregateSheet.PLAYER_STORAGE_KEY,
        JSON.stringify(players)
      );
    } catch {
      // Ignore write failures.
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

  private findNextAvailablePlayerNumber(): number | null {
    const used = new Set(this.players().map((player) => this.playerIdToNumber(player.id)));
    for (let number = 1; number <= MahjongAggregateSheet.MAX_PLAYERS; number += 1) {
      if (!used.has(number)) {
        return number;
      }
    }

    return null;
  }

  private playerIdToNumber(id: string): number {
    const parsed = Number.parseInt(id.replace('p', ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private getLocalStorage(): Storage | null {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  }
}
