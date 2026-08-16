// =============================================
// HomeyScript (hulpscript): zoek presence-apparaten op
// ---------------------------------------------
// Print alle apparaten met een capability die op 'presence' lijkt,
// inclusief hun UUID. Vul die UUID in f1-notificatie.js -> presenceDeviceId.
//
// Dit script retourneert een leesbare tekst (zodat je de output direct ziet),
// naast de console-logregels.
// =============================================

const devs = await Homey.devices.getDevices();
const list = Object.values(devs)
  .filter(d => Array.isArray(d.capabilities))
  .filter(d => d.capabilities.some(c => /presence/i.test(c)));

if (list.length === 0) {
  const msg = 'Geen presence-apparaten gevonden met een capability die "presence" bevat.';
  console.log(msg);
  console.log('--- alle apparaten met hun capabilities (ter controle) ---');
  Object.values(devs).forEach(d => {
    console.log(`${d.name} | id=${d.id} | caps=${(d.capabilities || []).join(', ')}`);
  });
  return msg;
}

const lines = list.map(d => {
  const caps = d.capabilities.filter(c => /presence/i.test(c));
  return `${d.name}\n  id = ${d.id}\n  presence-caps = ${caps.join(', ')}`;
});

const report = `Gevonden presence-apparaten (${list.length}):\n\n` + lines.join('\n\n');
console.log(report);
return report;
