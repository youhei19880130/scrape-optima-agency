Scrape for オプティマエージェンシー
====
オプティマエージェンシーにログインし、必要な成果をスクレイピングするスクリプト

## Description

## Demo

## VS. 

## Requirement

## Usage
- Cloud Functions 用のコードをローカルで実行する環境を構築します。
```bash
$ npm install @google-cloud/functions-framework -g
$ npm install npm-watch
$ npm install puppeteer
$ npm install --save-dev npm-check-updates
$ npm-check-updates -u && npm update #もしアップデートするものがあれば、これでアップデートされる
```
### ローカルからCloud Functionsを動かす
- ローカルに環境を立つ上げる
```bash
$ npm run watch
```
- httpでアクセスする
```bash
$ curl localhost:8080
```

## Install

## Contribution

## tips
### デバッグ用のスクショの取り方
以下のコードをスクショ取りたい部分に追加する
```javascript
await page.screenshot({
    path: './sample0.png',
    fullPage: true,
});
```