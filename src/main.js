const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const pdf = require('pdf-parse');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('open-url', async (_event, url) => {
  await shell.openExternal(url);
  return true;
});

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function firstMatch(text, regexes) {
  for (const rx of regexes) {
    const m = text.match(rx);
    if (m) return clean(m[1] || m[0]);
  }
  return '';
}

function normalizePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0,3)}) ${n.slice(3,6)}-${n.slice(6)}` : clean(raw);
}

function normalizeAmount(raw) {
  const n = Number(String(raw || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : '';
}

function classifyLoanType(text) {
  if (/\bPACE\b|PROPERTY\s+ASSESSED\s+CLEAN\s+ENERGY/i.test(text)) return 'PACE';
  if (/\bUCC\b|FIXTURE\s+FILING|FINANCING\s+STATEMENT/i.test(text)) return 'UCC';
  return '';
}

function matchLender(text, lenders) {
  for (const lender of lenders) {
    for (const alias of lender.aliases) {
      if (text.toLowerCase().includes(alias.toLowerCase())) return lender.name;
    }
  }
  return '';
}

function extractLead(text, filename, lenders, countyHint) {
  const lender = matchLender(text, lenders);
  const loanType = classifyLoanType(text);
  if (!lender || !loanType) return null;

  const email = firstMatch(text, [/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i]);
  const phoneRaw = firstMatch(text, [/(?:\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4})/]);
  const amountRaw = firstMatch(text, [
    /(?:LOAN\s+AMOUNT|ORIGINAL\s+PRINCIPAL|FINANCED\s+AMOUNT|ASSESSMENT\s+AMOUNT|SECURED\s+AMOUNT|AMOUNT)\s*[:#-]?\s*(\$\s?[\d,]+(?:\.\d{2})?)/i,
    /(\$\s?[1-9][\d,]{3,}(?:\.\d{2})?)/
  ]);
  const date = firstMatch(text, [
    /(?:LOAN\s+DATE|EFFECTIVE\s+DATE|EXECUTED|DATED|RECORD(?:ED|ING)?\s+DATE|FILED)\s*[:#-]?\s*((?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2})/i,
    /\b((?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2})\b/
  ]);
  const name = firstMatch(text, [
    /(?:DEBTOR|BORROWER|PROPERTY\s+OWNER|OWNER)\s*(?:NAME)?\s*[:#-]\s*([^\n\r]{3,100})/i,
    /(?:GRANTOR)\s*[:#-]\s*([^\n\r]{3,100})/i
  ]);
  const address = firstMatch(text, [
    /(?:BORROWER|DEBTOR|OWNER|MAILING|PROPERTY)\s+ADDRESS\s*[:#-]\s*([^\n\r]{8,180})/i,
    /(?:ADDRESS)\s*[:#-]\s*([^\n\r]{8,180})/i
  ]);

  return {
    name, address, phone: normalizePhone(phoneRaw), email,
    lender, loanType, loanAmount: normalizeAmount(amountRaw), loanDate: date,
    county: countyHint || '', sourceFile: filename
  };
}

async function readFileText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const data = await pdf(fs.readFileSync(filePath));
    return data.text || '';
  }
  if (['.txt', '.csv', '.json', '.html', '.htm'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

ipcMain.handle('run-extraction', async (_event, opts) => {
  const inputFolder = opts.inputFolder;
  if (!inputFolder || !fs.existsSync(inputFolder)) throw new Error('Select a valid input folder.');
  const outputFolder = opts.outputFolder || inputFolder;
  const lenderConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'lenders.json'), 'utf8'));
  const files = fs.readdirSync(inputFolder).filter(f => /\.(pdf|txt|csv|json|html?)$/i.test(f));
  const leads = [];
  const errors = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    mainWindow.webContents.send('progress', { current: i + 1, total: files.length, filename });
    try {
      const text = await readFileText(path.join(inputFolder, filename));
      if (!text.trim()) continue;
      const lead = extractLead(text, filename, lenderConfig.lenders, opts.county || '');
      if (lead) leads.push(lead);
    } catch (err) {
      errors.push({ filename, error: err.message });
    }
  }

  const seen = new Set();
  const deduped = leads.filter(x => {
    const key = `${x.name}|${x.address}|${x.lender}|${x.loanDate}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Borrower Leads', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'NAME', key: 'name', width: 28 },
    { header: 'ADDRESS', key: 'address', width: 42 },
    { header: 'PHONE', key: 'phone', width: 18 },
    { header: 'EMAIL', key: 'email', width: 30 },
    { header: 'LENDER NAME', key: 'lender', width: 22 },
    { header: 'LOAN TYPE', key: 'loanType', width: 13 },
    { header: 'LOAN AMOUNT', key: 'loanAmount', width: 16 },
    { header: 'LOAN DATE', key: 'loanDate', width: 15 }
  ];
  deduped.forEach(x => sheet.addRow(x));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.autoFilter = 'A1:H1';
  sheet.getColumn('loanAmount').numFmt = '$#,##0.00';
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) row.alignment = { vertical: 'top', wrapText: true }; });

  const audit = workbook.addWorksheet('Audit');
  audit.columns = [
    { header: 'County', key: 'county', width: 18 },
    { header: 'Source File', key: 'sourceFile', width: 48 },
    { header: 'Matched Lender', key: 'lender', width: 22 },
    { header: 'Loan Type', key: 'loanType', width: 12 },
    { header: 'Borrower', key: 'name', width: 28 },
    { header: 'Address', key: 'address', width: 42 }
  ];
  deduped.forEach(x => audit.addRow(x));
  audit.getRow(1).font = { bold: true };

  const outPath = path.join(outputFolder, `Texas_Solar_Borrowers_${new Date().toISOString().slice(0,10)}.xlsx`);
  await workbook.xlsx.writeFile(outPath);
  return { outPath, reviewed: files.length, matched: leads.length, saved: deduped.length, errors };
});
