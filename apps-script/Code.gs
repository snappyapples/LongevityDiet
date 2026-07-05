/**
 * Longevity Diet — daily digest sender (Google Apps Script).
 *
 * This is the scheduler + mailman. Three time-driven triggers call the app's
 * /api/digest endpoint (which does all the gap analysis and HTML rendering) and
 * relay the result into Gmail — sent from your own account to yourself.
 *
 * SETUP (once):
 *   1. Paste this file + appsscript.json into a new Apps Script project
 *      (script.google.com → New project). Set the project time zone to
 *      America/Denver (or edit appsscript.json).
 *   2. Project Settings → Script Properties, add:
 *        APP_URL        = https://longevity-diet.vercel.app
 *        DIGEST_SECRET  = <the secret from your .env.local / Vercel>
 *        RECIPIENT      = justin.maner@gmail.com   (optional; defaults to you)
 *   3. Run installTriggers() once. Approve the Gmail + external-request prompts.
 *
 * To change send times: edit installTriggers() and run it again (it clears old
 * triggers first). To pause: run removeTriggers() or disable them in the UI.
 */

// ---- Trigger entry points (one per slot) --------------------------------

function sendMorning() {
  sendDigest_('morning');
}

function sendMidday() {
  sendDigest_('midday');
}

function sendEvening() {
  sendDigest_('evening');
}

// ---- Core ----------------------------------------------------------------

function sendDigest_(slot) {
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var secret = props.getProperty('DIGEST_SECRET');
  var recipient = props.getProperty('RECIPIENT') || Session.getEffectiveUser().getEmail();

  if (!appUrl || !secret) {
    throw new Error('Missing APP_URL or DIGEST_SECRET in Script Properties.');
  }

  var url = appUrl.replace(/\/$/, '') + '/api/digest?slot=' + encodeURIComponent(slot);
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true,
  });

  var code = res.getResponseCode();
  if (code !== 200) {
    throw new Error('Digest endpoint returned ' + code + ': ' + res.getContentText().slice(0, 300));
  }

  var payload = JSON.parse(res.getContentText());
  if (!payload.subject || !payload.html) {
    throw new Error('Digest response missing subject/html.');
  }

  MailApp.sendEmail({
    to: recipient,
    subject: payload.subject,
    htmlBody: payload.html,
    body: 'Open in an HTML-capable mail client to view your Longevity Diet digest.',
    name: 'Longevity Diet',
  });
}

// ---- Trigger management --------------------------------------------------

/** Install the three daily triggers (7:00 AM, 11:30 AM, 5:00 PM, script tz). */
function installTriggers() {
  removeTriggers();

  ScriptApp.newTrigger('sendMorning').timeBased().everyDays(1).atHour(7).create();
  ScriptApp.newTrigger('sendMidday').timeBased().everyDays(1).atHour(11).nearMinute(30).create();
  ScriptApp.newTrigger('sendEvening').timeBased().everyDays(1).atHour(17).create();

  Logger.log('Installed 3 digest triggers (07:00, 11:30, 17:00 %s).', Session.getScriptTimeZone());
}

/** Remove any triggers this script owns (safe to run repeatedly). */
function removeTriggers() {
  var handlers = { sendMorning: 1, sendMidday: 1, sendEvening: 1 };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlers[t.getHandlerFunction()]) ScriptApp.deleteTrigger(t);
  });
}

/** Manual smoke test — sends the morning digest right now. */
function testSendNow() {
  sendMorning();
}
