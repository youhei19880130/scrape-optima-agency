const functions = require('@google-cloud/functions-framework');
const puppeteer = require('puppeteer');

const TOP_URL = 'https://sub.affitima.jp/';
const REPORT_URL = 'https://sub.affitima.jp/clientadmin/report/monthly/list/';
const LOGIN_ID = process.env.OPTIMA_LOGIN_ID || 'cellnote';
const PASSWORD = process.env.OPTIMA_PASSWORD || 'cellnote';

// 商品名 → 広告プルダウンの検索キーワード（部分一致で全ヒットを選択する）
const PRODUCTS = {
    'セルノートサプリメント_縛り無し': '【BV LINE supplement+】コアプロダクト_meta_980円縛り無しオファー_即チャットLP',
};

// 前日から daysAgo 日さかのぼった日付を返す
function getTargetDate(daysAgo) {
    const dt = new Date();
    dt.setDate(dt.getDate() - 1 - daysAgo);
    return {year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate()};
}

function formatDate({year, month, day}) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function login(page) {
    await page.goto(TOP_URL);
    const loginForm = 'body > div.page > div > div.my-3.my-md-5 > div > div.row.row-cards.row-deck > div:nth-child(2) > div > form > div.card-body';
    await page.waitForSelector(loginForm + ' > div.mb-3 > input');
    await page.type(loginForm + ' > div.mb-3 > input', LOGIN_ID, {delay: 100});
    await page.type(loginForm + ' > div:nth-child(2) > input', PASSWORD, {delay: 100});
    // ログインボタンにセレクタで到達できないため、Tab移動でフォーカスして送信する
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForSelector('body > div.page > div > div.header.py-4 > div > div > div > div > a > span > small');
}

async function textContent(elementHandle) {
    return (await elementHandle.getProperty('textContent')).jsonValue();
}

// 時系列レポートでキーワードに一致する広告をすべて選択し、対象日の {cv, amount} セル文字列を返す
async function fetchDailyCells(page, keyword, month, day) {
    await page.goto(REPORT_URL);
    await page.waitForSelector('a[href="/clientadmin/report/monthly/list"]');

    await page.click('#searchField > div.card-header.card-header-info > h5');
    await page.click('#searchField > form > div > div.card-body > div > span > span.selection > span > ul > li > input');
    await page.type('#searchField > form > div > div.card-body > div > span > span.selection > span > ul > li > input', keyword);
    const size = (await page.$$('.select2-results__options > li')).length;
    for (let i = 0; i < size; i++) {
        await page.click('ul.select2-results__options > li:nth-child(' + (i + 1) + ')');
    }
    await page.click('#searchField > form > div > div.card-body > div:nth-child(1) > span > span > span');
    await page.click('#searchField > form > div > div.card-footer > button.btn.btn-info');
    await page.waitForSelector('a[href="/clientadmin/report/monthly/list"]');

    // 対象月の日別レポートへ
    await Promise.all([
        page.waitForNavigation({waitUntil: ['load']}),
        page.click('body > div.page > div > div.my-3.my-md-5 > div > div:nth-child(3) > div > div > div.card-body > div.table-responsive > table > tbody > tr:nth-child(' + month + ') > td.text-center > form > button'),
    ]);

    const cv = await textContent(await page.$('table > tbody > tr:nth-child(' + day + ') > td:nth-child(3)'));
    const amount = await textContent(await page.$('table > tbody > tr:nth-child(' + day + ') > td:nth-child(6)'));
    return {cv, amount};
}

functions.http('getOptimaAgency', async (req, res) => {
    const product = req.query['product'];
    console.log('対象商品: ' + product);
    const keyword = PRODUCTS[product];
    if (!keyword) {
        res.status(400).send('unknown product: ' + product);
        return;
    }

    const daysAgo = parseInt(req.query['days_ago']) || 0;
    const targetDate = getTargetDate(daysAgo);
    console.log('target date: ' + targetDate.month + '-' + targetDate.day);

    const browser = await puppeteer.launch({
        defaultViewport: {
            width: 1000,
            height: 800,
        },
        headless: 'new',
        args: [
            '--no-sandbox',
            '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36'
        ],
        slowMo: 100
    });

    try {
        const page = await browser.newPage();
        await login(page);
        const cells = await fetchDailyCells(page, keyword, targetDate.month, targetDate.day);

        const cv = cells.cv.replace('件', '');
        const amount = cells.amount.replace('円', '').replaceAll(',', '');
        console.log('件数/売上: ' + cells.cv + '/' + cells.amount);

        // このリポジトリは従来から日付を先頭に出力する形式（対象日,件数,売上）
        res.status(200).send([formatDate(targetDate), cv, amount].toString());
    } finally {
        await browser.close();
    }
});
