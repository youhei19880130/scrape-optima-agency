const functions = require('@google-cloud/functions-framework');

functions.http('getOptimaAgency', async (req, res) => {
    const puppeteer = require('puppeteer');
    const product = req.query['product'];
    // let advertiseIds = [];
    let keyword = '';
    switch (product) {
        case 'セルノートサプリメント_縛り無し':
            keyword = '【BV LINE supplement+】コアプロダクト_meta_980円縛り無しオファー_即チャットLP';
            break;
    }
    console.log("対象商品: " + product);

    let daysAgo = 0;
    if (req.query['days_ago']) {
        daysAgo = parseInt(req.query['days_ago']);
    }

    const sleep = milliseconds =>
        new Promise(resolve =>
            setTimeout(resolve, milliseconds)
        );

    // 前日の日付取得
    let dt = new Date();
    let day = dt.getDate();
    dt.setDate(day - 1 - daysAgo);
    const year = dt.getFullYear();
    const month = dt.getMonth()+1;
    day   = dt.getDate();

    const url = 'https://sub.affitima.jp/';
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
    const page = await browser.newPage();

    console.log('target date: ' + month + '-' + day);
    let headers;
    page.on('response', response => {
        if (response.url() == url) {
            headers = response.headers();
        }
    });
    const client = await page.target().createCDPSession();
    await client.send('Performance.enable');
    await page.goto(url);
    await page.waitForSelector('body > div.page > div > div.my-3.my-md-5 > div > div.row.row-cards.row-deck > div:nth-child(2) > div > form > div.card-body > div.mb-3 > input');

    // ログイン
    await page.type('body > div.page > div > div.my-3.my-md-5 > div > div.row.row-cards.row-deck > div:nth-child(2) > div > form > div.card-body > div.mb-3 > input','cellnote',{delay:100});
    await page.type('body > div.page > div > div.my-3.my-md-5 > div > div.row.row-cards.row-deck > div:nth-child(2) > div > form > div.card-body > div:nth-child(2) > input','cellnote',{delay:100});
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForSelector('body > div.page > div > div.header.py-4 > div > div > div > div > a > span > small');

    // 成果一覧ページへ遷移
    await page.goto('https://sub.affitima.jp/clientadmin/report/monthly/list/')
    await page.waitForSelector('a[href="/clientadmin/report/monthly/list"]');

    await page.click('#searchField > div.card-header.card-header-info > h5');
    await page.click('#searchField > form > div > div.card-body > div > span > span.selection > span > ul > li > input');

    // for (const advertiseId of advertiseIds) {
    //     await page.click('ul.select2-results__options > li:nth-child(' + advertiseId + ')');
    // }
    await page.type('#searchField > form > div > div.card-body > div > span > span.selection > span > ul > li > input', keyword);
    let size = (await page.$$('.select2-results__options > li')).length
    for (let i = 0; i < size; i++) {
        await page.click('ul.select2-results__options > li:nth-child(' + (i+1) + ')');
    }
    await page.click('#searchField > form > div > div.card-body > div:nth-child(1) > span > span > span');
    await page.click('#searchField > form > div > div.card-footer > button.btn.btn-info');
    await page.waitForSelector('a[href="/clientadmin/report/monthly/list"]');

    await Promise.all([
        page.waitForNavigation({waitUntil: ['load']}),
        page.click('body > div.page > div > div.my-3.my-md-5 > div > div:nth-child(3) > div > div > div.card-body > div.table-responsive > table > tbody > tr:nth-child(' + month + ') > td.text-center > form > button')
    ]);

    let cv = await (await (await page.$('table > tbody > tr:nth-child(' + day + ') > td:nth-child(3)')).getProperty('textContent')).jsonValue();
    let amount = await (await (await page.$('table > tbody > tr:nth-child(' + day + ') > td:nth-child(6)')).getProperty('textContent')).jsonValue();

    await browser.close();

    console.log("件数/売上: " + cv + "/" + amount);

    res.status(200).send([`${year}-${('00' + month).slice(-2)}-${('00' + day).slice(-2)}`, cv.replace('件',''), amount.replace('円','').replace(',','')].toString());
});
