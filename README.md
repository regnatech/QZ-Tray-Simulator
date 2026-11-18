# Clicketta Thermal Simulator

Simulatore professionale di stampanti termiche **ESC/POS** compatibile con **QZ Tray**,
pensato per lo sviluppo, il debug, la formazione e le demo di software gestionali e POS
(Clicketta e qualsiasi altro software compatibile con QZ Tray).

Applicazione **desktop, completamente offline**, per Windows, Linux e macOS.

![Dashboard](docs/screenshots/01-dashboard.png)

## Caratteristiche principali

- **Stampanti virtuali** — crea, modifica, duplica, elimina e attiva/disattiva stampanti
  con nome, descrizione, driver simulato, porta, larghezza carta (58/80 mm), identificativo,
  stato, colore e icona.
- **Layer compatibile QZ Tray** — le stampanti sono individuabili via `qz.printers.find()`
  e ricevono i dati inviati da `qz.print()` su WebSocket (`ws://127.0.0.1:8182`).
- **Stampanti di rete (RAW TCP / JetDirect)** — ogni stampante può essere esposta come una
  vera stampante Ethernet su IP e porta (default `9100`, `9101`, …), raggiungibile anche dagli
  altri dispositivi della LAN. Risponde alle richieste di stato `DLE EOT n` e `GS r n` in base
  agli errori simulati.
- **Parser ESC/POS** — interpreta i principali comandi: `ESC @`, `ESC E`, `ESC a`, `ESC p`,
  `ESC B`, `GS V`, `GS k` (barcode), `GS ( k` (QR), `ESC 3`, `ESC !`, `GS !`, `ESC d`,
  immagini raster `GS v 0` e altri.
- **Rendering realistico** — scontrini su carta termica con font monospace, grassetto, font
  multipli, allineamenti, separatori, **QR code reali** e **barcode reali**, immagini raster.
- **Animazioni ed effetti** — taglio carta, apertura cassetto e beep, con suoni sintetizzati
  configurabili.
- **Monitoraggio Live & Control Center** — tutte le stampanti in tempo reale (stato, ultima
  stampa, lavori, coda, carta residua, errori) con layout stile NOC.
- **Storico** — ogni stampa è memorizzata con raw, rendering e durata; ricerca, filtri ed
  esportazione **JSON / CSV / PDF**.
- **Simulazione errori** — carta terminata/quasi terminata, offline, non raggiungibile,
  coperchio aperto, buffer pieno, errore generico.
- **Statistiche** — stampe giornaliere/settimanali/mensili, utilizzo per stampante, tempo
  medio di elaborazione, numero errori, grafici in tempo reale.
- **Generatore di traffico** — 10 / 50 / 100 / 500 stampe al minuto per stress test.
- **API HTTP locale** — `GET /api/printers`, `POST /api/print`, `GET /api/history`,
  `GET /api/stats`, `GET /api/health`.
- **Logging centralizzato** — livelli DEBUG/INFO/WARNING/ERROR con esportazione.

## Stack tecnologico

Electron · Vue 3 · Vite · TypeScript · Pinia · TailwindCSS · SQLite (better-sqlite3)

## Architettura

```
Electron
├── Main Process        src/main/index.ts          ciclo di vita + finestra
│   ├── IPC Layer        src/main/ipc.ts            router invoke + broadcast eventi
│   ├── SQLite Layer     src/main/db/*              Store (SQLite | in-memory)
│   ├── ESC/POS Parser   src/main/escpos/*          parser + builder
│   ├── Virtual Engine   src/main/engine/*          PrinterManager + TrafficSimulator
│   ├── Local API Server src/main/server/apiServer  Express
│   ├── QZ Server        src/main/server/qzServer   WebSocket compatibile QZ Tray
│   └── Network Server   src/main/server/networkServer  RAW TCP (porta 9100) per stampante
├── Preload Process     src/preload/index.ts        contextBridge tipizzato
├── Shared              src/shared/*                tipi + contratto IPC
└── Vue Frontend        src/renderer/*              UI (stores Pinia, viste, componenti)
```

### Schema database (SQLite)

`printers`, `print_jobs`, `print_history`, `simulated_errors`, `settings`, `statistics`, `logs`.

### Store Pinia

`useAppStore`, `usePrintersStore`, `useHistoryStore`, `useStatisticsStore`,
`useSimulationStore`, `useSettingsStore`.

## Avvio

```bash
npm install          # installa le dipendenze e ricompila better-sqlite3 per Electron
npm run dev          # avvia l'app in sviluppo (hot reload)
npm run build        # typecheck + build di produzione
npm run build:linux  # (oppure :win / :mac) crea il pacchetto distribuibile
```

## Integrazione QZ Tray

Il client `qz-tray.js` può puntare all'endpoint insecuro del simulatore:

```js
qz.websocket.connect({ host: '127.0.0.1', usingSecure: false })   // porta 8182
await qz.printers.find('Cucina')
await qz.print(qz.configs.create('Cucina'), [
  { type: 'raw', format: 'base64', data: '<payload ESC/POS in base64>' }
])
```

## Stampanti di rete

Ogni stampante con **Stampante di rete** attiva apre un listener TCP RAW, come una stampante
termica Ethernet reale. Nel gestionale si configura come stampante di rete indicando l'IP del
PC su cui gira il simulatore (visibile in *Impostazioni* e nel dettaglio stampante) e la porta.

| Stampante predefinita | Porta |
|---|---|
| Cucina | 9100 |
| Bar    | 9101 |
| Cassa  | 9102 |

- Ogni connessione forma un lavoro di stampa: viene chiuso alla chiusura del socket oppure dopo
  1 secondo di inattività, per i client che tengono aperta la connessione.
- `DLE EOT 1..4` e `GS r 1/2` ricevono subito il byte di stato coerente con gli errori simulati
  (carta terminata/quasi terminata, coperchio aperto, offline...). Le connessioni che inviano
  solo richieste di stato non generano stampe.
- L'errore simulato *Non raggiungibile* fa chiudere subito le connessioni; disattivare la
  stampante chiude la porta.
- Indirizzo di ascolto `0.0.0.0` (tutta la LAN, al primo avvio Windows può chiedere il permesso
  del firewall) oppure `127.0.0.1` (solo questo PC).

```bash
# Linux / macOS
printf '\x1b@Ciao dalla rete\n\n\n\x1dV\x00' | nc 127.0.0.1 9100
```

```powershell
# Windows
$c = New-Object Net.Sockets.TcpClient('127.0.0.1', 9100)
$b = [byte[]](0x1b,0x40) + [Text.Encoding]::ASCII.GetBytes("Ciao dalla rete`n`n`n") + [byte[]](0x1d,0x56,0x00)
$c.GetStream().Write($b, 0, $b.Length); $c.Close()
```

## API locale (esempi)

L'API HTTP ascolta sulla porta `8183`. La 9100 è riservata alle stampanti di rete: le
installazioni precedenti che usavano la 9100 per l'API vengono spostate automaticamente.

```bash
curl http://127.0.0.1:8183/api/printers
curl -X POST http://127.0.0.1:8183/api/print \
  -H 'Content-Type: application/json' \
  -d '{"printer":"Cucina","data":"<base64 ESC/POS>","encoding":"base64"}'
curl http://127.0.0.1:8183/api/history
curl http://127.0.0.1:8183/api/stats
```

## Test

Il progetto è coperto da test unitari (Vitest) e test end-to-end (Playwright + Electron).

```bash
npm run test         # 63 test unitari: parser, builder, engine, QZ, rete, API, store, export
npm run test:e2e     # build + e2e Electron (su Linux headless: xvfb-run npm run test:e2e)
```

I test e2e avviano l'app reale, creano una stampante, inviano una stampa, verificano il
rendering dello scontrino, l'API HTTP, il WebSocket QZ Tray e la stampa RAW TCP, e catturano
gli screenshot.

## Anteprima

| Stampanti | Storico & scontrino | Control Center |
|---|---|---|
| ![Stampanti](docs/screenshots/02-printers.png) | ![Scontrino](docs/screenshots/03-history-receipt.png) | ![Monitor](docs/screenshots/04-monitor.png) |

| Simulazioni | Statistiche | Sistema |
|---|---|---|
| ![Simulazioni](docs/screenshots/05-simulations.png) | ![Statistiche](docs/screenshots/06-statistics.png) | ![Sistema](docs/screenshots/08-system.png) |

## Autore

Realizzato da **[Regna Royal Tech](https://regna.tech)**.

## Licenza

Software **gratuito** con **licenza proprietaria**.

Copyright © Regna Royal Tech — [regna.tech](https://regna.tech). Tutti i diritti riservati.

Il software è distribuito gratuitamente. Non sono concessi i diritti di
modifica, redistribuzione o rivendita senza autorizzazione scritta di
Regna Royal Tech. Vedi il file [`LICENSE`](LICENSE) per il testo completo.
