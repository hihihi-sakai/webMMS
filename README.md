# WebMMS

**WebMMS（Web麻雀スコア管理システム）** は、麻雀の対局結果を記録・集計するWebアプリケーションです。

## 公開ページ

- GitHub Pages: https://hihihi-sakai.github.io/webMMS/

## 主な機能

- **スコアシート** — 半荘1回分の点数を4名分入力し、ウマ・オカを含めた最終スコアを自動計算します。
- **集計シート** — 最大8名のプレーヤーを登録し、半荘ごとに4名を選んで結果を蓄積。通算ポイント・平均・収支を一覧で確認できます。
- **データ永続化** — 入力したプレーヤー情報と対局履歴はブラウザの `localStorage` に自動保存されます。
- **PWA対応** — オフライン環境でも利用できます。

## 動作環境

モダンブラウザ（Chrome / Edge / Safari / Firefox 最新版）で動作します。

---

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
