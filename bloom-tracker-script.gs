function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = 'Tracker';
  const statusCol = 3; // Column C = Status
  const appDateCol = 6; // Column F
  const logSheetName = 'StatusHistory';
  const trackerSheetName = '_StatusTracker';

  if (sheet.getName() !== sheetName || e.range.getColumn() !== statusCol) return;

  const row = e.range.getRow();
  const company = sheet.getRange(row, 1).getValue();
  const title = sheet.getRange(row, 2).getValue();
  const newStatus = e.range.getValue();

  const ss = e.source;
  const trackerSheet = getOrCreateSheet(ss, trackerSheetName, ['Company', 'Title', 'Status']);
  const logSheet = getOrCreateSheet(ss, logSheetName, ['Timestamp', 'Company', 'Title', 'Old Status', 'New Status']);

  const cache = CacheService.getScriptCache();
  const cacheKey = `status-${company}-${title}`;
  const cachedOldStatus = cache.get(cacheKey);

  let trackerData = trackerSheet.getDataRange().getValues();
  let trackerRowIndex = trackerData.findIndex((r, i) => i > 0 && r[0] === company && r[1] === title);
  let oldStatus = cachedOldStatus || '';

  if (!cachedOldStatus && trackerRowIndex !== -1) {
    oldStatus = trackerData[trackerRowIndex][2];
  }

  // Cache current status for future reference
  cache.put(cacheKey, newStatus, 300); // expires in 5 mins

  if (oldStatus !== newStatus) {
    logSheet.appendRow([new Date(), company, title, oldStatus, newStatus]);

    if (trackerRowIndex !== -1) {
      trackerSheet.getRange(trackerRowIndex + 1, 3).setValue(newStatus);
    } else {
      trackerSheet.appendRow([company, title, newStatus]);
    }

    if (newStatus === "Applied") {
      const applicationDateRange = sheet.getRange(row, appDateCol);
      if (applicationDateRange.isBlank()) {
        applicationDateRange.setValue(new Date());
      }
    }

    populateFollowups();
    calculateJobMetrics();
  }
}


/**
 * Update all metrics and followups when sheet opens
 */
function updateAllFollowups() {
  populateFollowups();
  calculateJobMetrics();
}

/**
 * Gets or creates a sheet with the specified name and headers
 */
function getOrCreateSheet(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  return sheet;
}


function showUserGuide() {
  const template = HtmlService.createTemplateFromFile('UserGuide');
  template.logoUrl = "https://vzwgrhprnxiqhptajhrn.supabase.co/storage/v1/object/public/public_logos//Google%20Sheet%20Logo.png";
  const html = template.evaluate()
    .setWidth(640)
    .setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, 'User Guide');
}


function showAboutPopup() {
  const template = HtmlService.createTemplateFromFile('About');
  template.logoUrl = "https://vzwgrhprnxiqhptajhrn.supabase.co/storage/v1/object/public/public_logos//Google%20Sheet%20Logo.png";
  const html = template.evaluate()
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(html, 'About This Tracker');
}


function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tracker Options')
    .addItem('📖 Show User Guide', 'showUserGuide')
    .addItem('🧹 Clean Deleted Applications', 'runCleanWithModal')
    .addItem('🔄 Update Followups', 'populateFollowups')
    .addItem('📊 Visualize Search Progress', 'createSankeyDiagram')
    .addItem('ℹ️ About', 'showAboutPopup')
    .addToUi();

  // Update followups when sheet is opened
  updateAllFollowups();
}


