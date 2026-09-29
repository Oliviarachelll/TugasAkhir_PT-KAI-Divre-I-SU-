const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { ExportConcurrencyError } = require('./export-concurrency');
const {
  formatDate,
  formatDateTime,
  formatNumber,
  formatCurrency,
} = require('./report-formatters');

const templateDirectory = path.join(__dirname, '..', '..', 'templates', 'reports');
const assetDirectory = path.join(__dirname, '..', '..', 'assets', 'reports');

let browserPromise = null;
let compiledTemplates = null;

const readTemplate = (relativePath) => fs.readFileSync(path.join(templateDirectory, relativePath), 'utf8');

const getLogoDataUri = () => {
  const webpPath = path.join(assetDirectory, 'kai-logo.webp');
  const pngPath = path.join(assetDirectory, 'kai-logo.png');
  const selectedPath = fs.existsSync(webpPath) ? webpPath : pngPath;
  const mime = selectedPath.endsWith('.webp') ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(selectedPath).toString('base64')}`;
};

const registerHelpers = () => {
  Handlebars.registerHelper('formatDate', formatDate);
  Handlebars.registerHelper('formatDateTime', formatDateTime);
  Handlebars.registerHelper('formatCurrency', formatCurrency);
  Handlebars.registerHelper('formatNumber', (value, maximumFractionDigits, options) => {
    const digits = typeof maximumFractionDigits === 'number' ? maximumFractionDigits : 4;
    return formatNumber(value, digits, options);
  });
  Handlebars.registerHelper('fallback', (value, fallback) => (
    value === null || value === undefined || value === '' ? fallback : value
  ));
  Handlebars.registerHelper('lowercase', (value) => String(value || '').toLowerCase());
  Handlebars.registerHelper('join', (value, separator) => (
    Array.isArray(value) ? value.join(typeof separator === 'string' ? separator : ', ') : ''
  ));
  Handlebars.registerHelper('dateRange', (start, end) => {
    if (!start && !end) return 'Semua tanggal';
    if (start && end) return `${formatDate(start)} s.d. ${formatDate(end)}`;
    if (start) return `Sejak ${formatDate(start)}`;
    return `Sampai ${formatDate(end)}`;
  });
};

const getTemplates = () => {
  if (compiledTemplates) return compiledTemplates;

  registerHelpers();
  Handlebars.registerPartial('report', readTemplate(path.join('partials', 'report.hbs')));
  compiledTemplates = {
    body: Handlebars.compile(readTemplate('laporan.hbs')),
    header: Handlebars.compile(readTemplate(path.join('partials', 'header.hbs'))),
    footer: Handlebars.compile(readTemplate(path.join('partials', 'footer.hbs'))),
    styles: readTemplate('styles.css'),
  };
  return compiledTemplates;
};

const getBrowser = async () => {
  if (!browserPromise) {
    const args = ['--disable-dev-shm-usage'];
    if (process.env.PUPPETEER_NO_SANDBOX === 'true') {
      args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    browserPromise = puppeteer.launch({
      headless: true,
      args,
    }).catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  const browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
};

const renderPdf = async (model, { signal } = {}) => {
  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);

  const templates = getTemplates();
  const logoDataUri = getLogoDataUri();
  const viewModel = { ...model, styles: templates.styles, logoDataUri };
  const html = templates.body(viewModel);
  const headerTemplate = templates.header({ logoDataUri });
  const footerTemplate = templates.footer({});
  const browser = await getBrowser();
  if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
  const page = await browser.newPage();
  const abortPage = () => { void page.close().catch(() => {}); };
  signal?.addEventListener('abort', abortPage, { once: true });

  try {
    if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
        request.continue();
      } else {
        request.abort('blockedbyclient');
      }
    });

    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: '27mm', right: '11mm', bottom: '17mm', left: '11mm' },
      preferCSSPageSize: true,
      timeout: 60_000,
    });
    if (signal?.aborted) throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
    return Buffer.from(bytes);
  } catch (error) {
    if (signal?.aborted && error.code !== 'EXPORT_REQUEST_ABORTED') {
      throw new ExportConcurrencyError('EXPORT_REQUEST_ABORTED', 499);
    }
    throw error;
  } finally {
    signal?.removeEventListener('abort', abortPage);
    await page.close().catch(() => {});
  }
};

const closePdfBrowser = async () => {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  if (browser?.connected) await browser.close();
};

module.exports = {
  getTemplates,
  renderPdf,
  closePdfBrowser,
};
