const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const srcset = require('srcset');

const botUserAgents = [
  'Baiduspider',
  'bingbot',
  'Embedly',
  'facebookexternalhit',
  'LinkedInBot',
  'outbrain',
  'pinterest',
  'quora link preview',
  'rogerbot',
  'showyoubot',
  'Slackbot',
  'TelegramBot',
  'Twitterbot',
  'vkShare',
  'W3C_Validator',
  'WhatsApp',
  'Googlebot',
];
const userAgentPattern = new RegExp(botUserAgents.join('|'), 'i');

const staticFileExtensions = [
  'ai',
  'avi',
  'css',
  'dat',
  'dmg',
  'doc',
  'doc',
  'exe',
  'flv',
  'gif',
  'ico',
  'iso',
  'jpeg',
  'jpg',
  'js',
  'less',
  'm4a',
  'm4v',
  'mov',
  'mp3',
  'mp4',
  'mpeg',
  'mpg',
  'pdf',
  'png',
  'ppt',
  'psd',
  'rar',
  'rss',
  'svg',
  'swf',
  'tif',
  'torrent',
  'ttf',
  'txt',
  'wav',
  'wmv',
  'woff',
  'xls',
  'xml',
  'zip',
];
const excludeUrlPattern = new RegExp(
  `\\.(${staticFileExtensions.join('|')})$`,
  'i',
);

const renderPage = async (url) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  const content = await page.content();

  await browser.close();

  const $ = cheerio.load(content);

  $('a, head > link, link').each(function () {
    let href = $(this).attr('href');
    if (href && href.startsWith('/')) {
      $(this).attr('href', url + href);
    }
  });
  $('script, head > script, img').each(function () {
    let href = $(this).attr('src');
    if (href && href.startsWith('/')) {
      $(this).attr('src', url + href);
    }
  });
  $('picture img, picture source').each(function () {
    let srcSetAttr = $(this).attr('srcset');
    if (srcSetAttr && srcSetAttr.length) {
      let srcSetList = srcset.parse(srcSetAttr);
      $(this).attr(
        'srcset',
        srcset.stringify(
          srcSetList.map((src) => {
            if (src.url && src.url.startsWith('/')) {
              return {
                ...src,
                url: url + src.url,
              };
            }
            return src;
          }),
        ),
      );
    }
  });
  $('noscript').remove();

  return $.html();
};

export const renderStaticMiddleware = (url) => {
  const middleware = express.Router();

  middleware.id = 'volto-staticrender-bots';
  middleware.all('**', (req, res, next) => {
    const ua = req.headers['user-agent'];
    if (
      ua === undefined ||
      !userAgentPattern.test(ua) ||
      excludeUrlPattern.test(req.path)
    ) {
      next();
      return;
    }

    renderPage(url).then((html) => res.send(html));
  });

  return middleware;
};

export default (config) => {
  config.settings.expressMiddleware = [
    ...config.settings.expressMiddleware,
    renderStaticMiddleware(config.settings.apiPath),
  ];

  return config;
};
