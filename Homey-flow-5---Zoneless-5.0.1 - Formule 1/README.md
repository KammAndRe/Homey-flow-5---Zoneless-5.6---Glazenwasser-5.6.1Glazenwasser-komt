# Formule 1 Notificatie — HomeyScript

Een verbeterde versie van de F1-notificatie-flow, herschreven als HomeyScript.

> ⚠️ Het oorspronkelijke script kon niet werken: `Homey.flow.on(...)` bestaat niet in
> HomeyScript. HomeyScript kan **niet** zelfstandig naar flow-triggers luisteren —
> het wordt juist *door* een flow gestart via de kaart **"Voer HomeyScript uit"**.
> Daarnaast bestaat er geen Homey-app met id `ca.jolpi.f1`; de gebruikte app is de
> officiële **Formule 1**-app (`com.athom.formula1`), die de jolpica API gebruikt.

## Bestanden

- [`f1-notificatie.js`](./f1-notificatie.js) — het HomeyScript (invullen: `presenceDeviceId`).
- [`find-presence-device.js`](./find-presence-device.js) — hulpscript om de presence device-UUID op te zoeken.

## Hoe het werkt

```
[Formule 1 trigger-kaart] "De race gaat beginnen over ... 1 uur"
        │
        ▼
[Condition-kaart]  "Tijd tussen 7:00 en 23:00"   (optioneel, Homey Logica)
        │
        ▼
[Action-kaart] "Voer HomeyScript uit"  →  f1-notificatie
        │
        ▼
   presence-check + melding
```

Het script:
1. Leest jouw presence-apparaat uit (`presence`).
2. Stuurt een push-melding via `Homey.flow.runFlowCardAction` (thuis → rustige boodschap,
   afwezig → "snel naar huis!").
3. Houdt rate-limiting bij via een **Homey Logic-variabele**, want een
   script-run heeft geen geheugen tussen runs (een `let lastNotificationTime`
   aan de top van het script gaat verloren zodra de run eindigt).

## Voorbereiding in Homey

1. Installeer de officiële app **Formule 1** (`com.athom.formula1`).
2. Zorg dat je een presence-apparaat hebt (bijv. je smartphone met de Homey-app,
   capability `presence`).
3. Maak in **Apps → Logica** een tekst-variabele aan met de naam
   `5.0.1 - f1_last_notification` (lege waarde). Hiermee werkt de rate-limit.
4. Zoek het **device-ID (UUID)** van je presence-apparaat. Open in HomeyScript
   het hulpscript [`find-presence-device.js`](./find-presence-device.js) en druk op
   **Test**. Het script retourneert een leesbare tekst met alle presence-apparaten
   en hun UUID — deze tekst verschijnt bij **Returned:** (en extra details in de
   console-log).

   Kopieer het `id` veld van jouw toestel.

   > Komt er "Returned: undefined" terug? Dan liep het oude inline zoek-script wel
   > goed, maar gaf het geen return-waarde; kijk dan in de **console-log** voor de
   > lijst. Het nieuwe hulpscript retourneert de lijst wél.

5. Open `f1-notificatie.js` in HomeyScript en vul bovenin aan:
   - `presenceDeviceId`: de UUID uit stap 4.
   - eventueel `rateLimitMinutes`, `timeWindow` en de berichten.

## De flow bouwen

1. **Nieuwe flow** (of Advanced Flow).
2. **Wanneer**-kolom: kies **Formule 1 → "De race gaat beginnen over …"** en zet
   de tijd op **1 uur**.
3. **Dan**-kolom: kies **HomeyScript → "Voer HomeyScript uit"** en selecteer
   `f1-notificatie`.
4. Sla de flow op.

Optioneel: zet in de **En**-kolom de Logica-kaart "Tijd tussen …" zodat het
script zelf ook nog een tijdscheck heeft (defensief).

## Testen

Omdat er maar één keer per race een uur vooraf een trigger komt, test je zo:

### Test 1 — handmatig in HomeyScript
Open het script in HomeyScript en druk op **Test**. Bekijk de console-uitvoer:
- `🏁 F1-notificatiescript gestart`
- `🏠 Thuis gedetecteerd.` of `🚗 Afwezig gedetecteerd.`
- `Notificatie verzonden: …`
- Een melding verschijnt in Homey.

Let op: `⏰ Buiten tijdsvenster …` of `⏳ … binnen rate-limit …` betekenen dat het
script terecht is gestopt — pas voor de test tijdelijk `timeWindow.enabled=false`
of zet de variabele `5.0.1 - f1_last_notification` leeg.

### Test 2 — via de flow
- Zet in de trigger-kaart de tijd even op **0 minuten** of gebruik een andere
  Formule 1-trigger die nu vuurt (bijv. "De volgende race begint").
- Druk op de play-knop van de flow en controleer of de melding verschijnt.

### Test 3 — presence beiden
- Zet je smartphone-op-aanwezigheid uit (verlaat het huis / toggle presence in
  de app) en run het script opnieuw → je zou het "afwezig"-bericht moeten krijgen.

### Rate-limit verifiëren
Run het script twee keer kort na elkaar. De tweede run moet loggen
`⏳ … binnen rate-limit … overslaan` en géén melding sturen.

## Belangrijke correcties t.o.v. het oude script

| Probleem in het oude script | Oplossing |
|---|---|
| `Homey.flow.on(triggerId, …)` — bestaat niet in HomeyScript | Script wordt via flow-actiekaart gestart; geen interne trigger-listener |
| `ca.jolpi.f1.*` trigger-ID's — verzonnen | Officiële app `com.athom.formula1` met echte trigger-kaarten |
| `Homey.devices.getDevice(name)` met een naam | `getDevice({ id: UUID })` met device-UUID |
| `device.getCapabilityValue(cap)` — geen functie in HomeyScript | Lees via `device.capabilitiesObj[cap].value` |
| `lastNotificationTime` globale variabele — gaat verloren per run | Rate-limit via Homey Logic-variabele |
| `Homey.notifications.create({ user, message })` (Apps-SDK, niet in HomeyScript) | `Homey.flow.runFlowCardAction` met kaart `homey:manager:mobile:push_text` |

## Troubleshooting

- **"Capability presence niet gevonden"** → het `presenceDeviceId` klopt niet,
  of het apparaat heeft die capability niet. Voer `find-presence-device.js` uit om te zien welke
  presence-apparaten en UUID’s er zijn.
- **Geen melding** → check of `⏰ Buiten tijdsvenster` of `⏳ rate-limit` in de log
  staat; zet `CONFIG.debug = true`.
- **Rate-limit slaat niks op** → de Logic-variabele `5.0.1 - f1_last_notification` bestaat
  niet of heeft een andere naam.
- **`Homey.notifications.create is not a function`** → deze methode bestaat niet in
  HomeyScript (alleen in de Apps-SDK). Het script gebruikt in plaats daarvan
  `Homey.flow.runFlowCardAction` met de kaart `homey:manager:mobile:push_text`.
  Controleer dat `CONFIG.userName` exact klopt met een Homey-gebruiker (hoofdlettergevoelig).
