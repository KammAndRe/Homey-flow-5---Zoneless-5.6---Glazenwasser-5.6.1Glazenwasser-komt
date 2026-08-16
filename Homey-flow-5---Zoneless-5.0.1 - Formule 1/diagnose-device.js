// =============================================
// HomeyScript (diagnose): toon capabilities van één apparaat
// ---------------------------------------------
// Vul hieronder het device-ID in dat je van find-presence-device.js kreeg.
// Het script print en retourneert alle capabilities (+ hun huidige waarde)
// van dat apparaat, zodat je de juiste presence-capability kunt kiezen.
// =============================================

const DEVICE_ID = 'VERVANG_DOOR_JOUW_DEVICE_UUID'; // <-- jouw apparaat-ID

const device = await Homey.devices.getDevice({ id: DEVICE_ID });

if (!device) {
  const msg = `Apparaat met id ${DEVICE_ID} niet gevonden.`;
  console.log(msg);
  return msg;
}

console.log('Naam:', device.name);
console.log('Klasse:', device.class);
console.log('--- capabilities ---');

const caps = Object.keys(device.capabilitiesObj || {});
const lines = [];

if (caps.length === 0) {
  // capabilitiesObj kan leeg zijn; toon dan de capability-id-array
  const capIds = device.capabilities || [];
  const msg = `Geen capabilitiesObj. Ruwe capability-id's: ${capIds.join(', ') || '(geen)'}`;
  console.log(msg);
  lines.push(msg);
} else {
  caps.forEach(c => {
    const obj = device.capabilitiesObj[c];
    const val = obj && 'value' in obj ? JSON.stringify(obj.value) : '(geen waarde)';
    const line = `${c} = ${val}`;
    console.log(line);
    lines.push(line);
  });
}

const presenceLike = caps.filter(c => /presence|home|away|location|geofence/i.test(c));
if (presenceLike.length) {
  const note = `\n\nMogelijke presence-capabilities:\n${presenceLike.join('\n')}`;
  console.log(note);
  lines.push(note);
}

return `Apparaat: ${device.name}\n\nCapabilities:\n${lines.join('\n')}`;
