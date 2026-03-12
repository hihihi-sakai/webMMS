import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		redirectTo: 'aggregate',
		pathMatch: 'full'
	},
	{
		path: 'score',
		loadComponent: () =>
			import('./mahjong-score-sheet/mahjong-score-sheet').then(
				(m) => m.MahjongScoreSheet
			)
	},
	{
		path: 'aggregate',
		loadComponent: () =>
			import('./mahjong-aggregate-sheet/mahjong-aggregate-sheet').then(
				(m) => m.MahjongAggregateSheet
			)
	}
];
