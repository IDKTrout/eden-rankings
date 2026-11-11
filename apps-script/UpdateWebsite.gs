/**
 * Adds an "Eden website" menu to the AbEx Guild Rankings sheet.
 *
 * Setup (once):
 *   1. In the sheet: Extensions > Apps Script, paste this file in, and save.
 *   2. Project Settings > Script Properties > Add property:
 *        DEPLOY_HOOK_URL = the deploy hook URL from Cloudflare Pages
 *      (Pages project > Settings > Builds > Deploy hooks). Keep it out of the code:
 *      anyone with the URL can trigger a rebuild.
 *   3. Reload the sheet. Run "Eden website > Rebuild once a day" to add the daily rebuild.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Eden website')
    .addItem('Update website now', 'updateWebsite')
    .addItem('Rebuild once a day', 'installDailyRebuild')
    .addToUi();
}

function deployHookUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK_URL');
  if (!url) throw new Error('Add DEPLOY_HOOK_URL in Project Settings > Script Properties first.');
  return url;
}

/** Asks Cloudflare Pages to rebuild the site from the latest sheet data. */
function updateWebsite() {
  const res = UrlFetchApp.fetch(deployHookUrl_(), { method: 'post', muteHttpExceptions: true });
  const ok = res.getResponseCode() < 300;
  const msg = ok
    ? 'Rebuild started. edenafk.com shows the new data in about a minute.'
    : 'Cloudflare refused the rebuild (HTTP ' + res.getResponseCode() + '). Check DEPLOY_HOOK_URL.';
  try { SpreadsheetApp.getActive().toast(msg, 'Eden website', 8); } catch (e) { /* run from a trigger */ }
  if (!ok) throw new Error(msg);
}

/** Adds a daily rebuild at about 5 AM in the sheet's time zone (replaces any earlier one). */
function installDailyRebuild() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'updateWebsite')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('updateWebsite').timeBased().everyDays(1).atHour(5).create();
  SpreadsheetApp.getActive().toast('The site will rebuild once a day.', 'Eden website', 6);
}
