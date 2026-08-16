// =============================================
// HomeyScript: Formule 1 Notificatie (1 uur voor de race)
// ---------------------------------------------
// Dit script wordt NIET door een eigen trigger gelanceerd.
// HomeyScript kan niet luisteren naar flow-triggers (Homey.flow.on bestaat niet).
//
// Architectuur:
//   Flow  ->  Trigger-kaart "Formule 1: De race gaat beginnen over ... 1 uur"
//        ->  (optioneel) Condition-kaart "tijd tussen 7:00 en 23:00"
//        ->  Action-kaart "Voer HomeyScript uit"  ->  DIT script
//
// Wat het script doet:
//   1. Controleert of jij thuis bent (presence device).
//   2. Stuurt een push-melding via Homey.flow.runFlowCardAction
//      (kaart 'homey:manager:mobile:push_text').
//      Let op: Homey.notifications.create(...) is een Apps-SDK-methode en
//      bestaat NIET in HomeyScript.
//   3. Houdt een simpele rate-limit bij via een Homey variabele (tag),
//      omdat een script-run géén geheugen heeft tussen runs.
//
// Vereisten:
//   - Homey Pro / Cloud met de officiële "Formule 1" app (com.athom.formula1)
//     Deze app gebruikt de jolpica API: https://api.jolpi.ca/ergast/f1/
//   - Een presence-apparaat (bijv. smartphone met Homey-app, capability `presence`).
//   - (Optioneel) Better Logic of de ingebouwde "Logica" app voor een variabele
//     "5.0.1 - f1_last_notification" om rate-limiting tussen runs te bewaren.
// =============================================

// ---- CONFIG ---- pas deze waarden aan op jouw situatie ----
const CONFIG = {
  // UNIEKE ID van jouw presence-apparaat (UUID), NIET de naam.
  // Vind de UUID:  HomeyScript -> voer uit:
  //   const devs = await Homey.devices.getDevices();
  //   Object.values(devs).filter(d => d.capabilities && d.capabilities.includes('presence'))
  //     .forEach(d => console.log(d.id, '|', d.name));
  presenceDeviceId: 'VERVANG_DOOR_JOUW_DEVICE_UUID',  // zie find-presence-device.js

  presenceCapability: 'presence',         // true = thuis, false = afwezig

  // Naam van de Homey Logic-variabele (Text of Number) voor rate-limiting.
  // Leeg laten om rate-limiting via variabele uit te schakelen.
  rateLimitVariable: '5.0.1 - f1_last_notification',

  rateLimitMinutes: 60,

  // Tijdsvenster waarin meldingen mogen worden gestuurd (lokaal, 24u).
  timeWindow: { enabled: true, start: 7, end: 23 },

  messages: {
    atHome: '🏁 Formule 1 start over een uurtje. Geniet ervan!',
    away:   '🚨 Hup, snel naar huis! Formule 1 start over een uurtje.'
  },

  // Naam van de Homey-gebruiker aan wie de push-melding wordt gestuurd.
  // Leeg laten om de eerste gebruiker uit Homey.users.getUsers() te gebruiken.
  userName: '',  // vul je Homey-gebruikersnaam in (hoofdlettergevoelig), of laat leeg voor de eerste gebruiker

  // Bij fouten een melding naar de gebruiker sturen?
  notifyOnError: true,

  debug: true
};

// ---- helpers ----
function log(...a)  { if (CONFIG.debug) console.log(...a); }
function logErr(...a) { console.error(...a); }

// Lees een Logic-variabele uit (string). Geeft null als deze niet bestaat/leeg is.
async function readLogicVariable(name) {
  try {
    const vars = await Homey.logic.getVariables();
    const v = Object.values(vars).find(x => x.name === name);
    return v ? v.value : null;
  } catch (e) {
    log('Logic.getVariables niet beschikbaar of mislukt:', e.message);
    return null;
  }
}

// Schrijf een Logic-variabele bij (als deze bestaat).
async function writeLogicVariable(name, value) {
  try {
    const vars = await Homey.logic.getVariables();
    const v = Object.values(vars).find(x => x.name === name);
    if (!v) {
      log(`Logic-variabele "${name}" niet gevonden; rate-limit niet opgeslagen.`);
      return false;
    }
    await Homey.logic.updateVariable({ id: v.id, value: String(value) });
    return true;
  } catch (e) {
    log('Logic.updateVariable mislukt:', e.message);
    return false;
  }
}

// Presence uitlezen via capabilitiesObj (de manier die in HomeyScript werkt).
async function isAtHome() {
  const device = await Homey.devices.getDevice({ id: CONFIG.presenceDeviceId });
  const cap = device && device.capabilitiesObj && device.capabilitiesObj[CONFIG.presenceCapability];
  if (!cap) {
    throw new Error(`Capability "${CONFIG.presenceCapability}" niet gevonden op device ${CONFIG.presenceDeviceId}`);
  }
  // 'presence' capability van de Homey-app: true = thuis, false = afwezig.
  // De meeste presence-devices in Homey gebruiken true = aanwezig.
  return cap.value === true;
}

// Zoek een Homey-gebruiker op naam; anders de eerste gebruiker.
async function resolveUser() {
  const users = await Homey.users.getUsers();
  const list = Object.values(users);
  if (CONFIG.userName) {
    const match = list.find(u => u.name === CONFIG.userName);
    if (match) return match;
    log(`Gebruiker "${CONFIG.userName}" niet gevonden; gebruik eerste gebruiker.`);
  }
  if (!list.length) throw new Error('Geen Homey-gebruikers gevonden.');
  return list[0];
}

// Stuur een push-melding via de ingebouwde notificatie-flowkaart.
// HomeyScript kent geen Homey.notifications.create; we gebruiken
// Homey.flow.runFlowCardAction met de kaart 'homey:manager:mobile:push_text'.
async function sendNotification(message) {
  const user = await resolveUser();
  // args.user verwacht zowel athomId als id (zie Homey community).
  await Homey.flow.runFlowCardAction({
    uri: 'homey:manager:mobile',
    id: 'homey:manager:mobile:push_text',
    args: {
      user: { athomId: user.athomId, id: user.id },
      text: message
    }
  });
  log('Notificatie verzonden naar', user.name + ':', message);
}

// ---- hoofdlogica ----
async function run() {
  log('🏁 F1-notificatiescript gestart');

  // 1. Tijdsvenster (7:00–23:00 lokaal)
  if (CONFIG.timeWindow.enabled) {
    const hour = new Date().getHours();
    if (hour < CONFIG.timeWindow.start || hour >= CONFIG.timeWindow.end) {
      log(`⏰ Buiten tijdsvenster (${CONFIG.timeWindow.start}:00–${CONFIG.timeWindow.end}:00), huidig uur ${hour}.`);
      return { skipped: 'time_window' };
    }
  }

  // 2. Rate-limiting via Logic-variabele (overschrijft niet-bestaande var niet)
  if (CONFIG.rateLimitVariable) {
    const lastStr = await readLogicVariable(CONFIG.rateLimitVariable);
    const lastTs = lastStr ? parseInt(lastStr, 10) : 0;
    const now = Date.now();
    if (lastTs && (now - lastTs) < CONFIG.rateLimitMinutes * 60 * 1000) {
      const mins = Math.round((now - lastTs) / 60000);
      log(`⏳ Laatste melding was ${mins} min geleden; binnen rate-limit van ${CONFIG.rateLimitMinutes} min. Overslaan.`);
      return { skipped: 'rate_limit', minutesSinceLast: mins };
    }
  }

  // 3. Presence bepalen
  const home = await isAtHome();
  log(home ? '🏠 Thuis gedetecteerd.' : '🚗 Afwezig gedetecteerd.');

  // 4. Notificatie
  await sendNotification(home ? CONFIG.messages.atHome : CONFIG.messages.away);

  // 5. Rate-limit bijwerken
  if (CONFIG.rateLimitVariable) {
    await writeLogicVariable(CONFIG.rateLimitVariable, String(Date.now()));
  }

  return { sent: true, atHome: home };
}

// ---- entrypoint ----
try {
  const result = await run();
  log('Resultaat:', JSON.stringify(result));
  // Return-waarde is zichtbaar in de flow als tag "Script Result" (indien gebruikt
  // met de "Voer HomeyScript uit en retourneer tekst/nummer" kaart).
  return result && result.sent ? 'verzonden' : 'overgeslagen';
} catch (error) {
  logErr('❌ Fout:', error.message);
  if (CONFIG.notifyOnError) {
    try { await sendNotification(`⚠️ F1 Script fout: ${error.message}`); } catch (_) {}
  }
  return `fout: ${error.message}`;
}
