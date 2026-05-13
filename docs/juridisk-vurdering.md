# Juridisk vurdering av STK — det Nordlys bommer på

> Notat fra perspektivet til en claude-jurist med erfaring fra norsk kraftsektor.
> Underlag: `stage/index.html` (pitch) og `docs/intervju-analyse.html`.
> Skrevet 2026-04-29.

STK løser et reelt teknisk problem, men er presentert som om kraftbransjen var et nøytralt informasjonsmarked. Det er den ikke — den er en av Norges mest gjennomregulerte sektorer. Punktene under er det som må adresseres før plattformen kan rulles ut hos aktørene som er intervjuet.

---

## 1. Kraftberedskapsforskriften (kbf.) er ikke nevnt med ett ord

Hendelsesdata fra driftskontrollsystemer er som hovedregel **kraftsensitiv informasjon** etter kbf. § 6-2. Å gossipe slik informasjon mellom KBO-enheter krever NVEs samtykke og dokumentert behov-til-å-vite.

"Automatisk deling av TLP-grønn informasjon" gjør nettopp den vurderingen umulig. TLP er ikke et rettslig rammeverk, og maskinell merking erstatter ikke skjønnet kbf. krever.

## 2. Sikkerhetsloven og klassifisering

Flere av de intervjuede (Statnett, NSM) opererer under sikkerhetsloven. IoC-er om angrep mot grunnleggende nasjonale funksjoner kan raskt bli BEGRENSET eller høyere. Mesh-arkitekturen har ingen mekanisme for å håndtere graderte data — det er alt eller ingenting.

## 3. NIS2 / digitalsikkerhetsloven

Forslaget snakker ikke om varslingsplikten til **myndighet** (NSM/sektor-CSIRT/RME). STK kan ikke erstatte den lovpålagte rapporteringen, og må vise hvordan den *understøtter* den uten å skape en parallell, uoffisiell varslingskanal.

## 4. Ansvar og hefting

Hvis Hafslund signerer en feilaktig IoC som leder Glitrenett til å isolere en stasjon — hvem hefter? Det finnes ingen juridisk enhet bak "sektoren eier plattformen".

Open source-lisens fritar utvikleren, men ikke peer-en som signerte eventet. Det trengs:

- Juridisk enhet (forening, stiftelse eller AS)
- Peering-avtale mellom deltakerne
- Ansvarsbegrensning og forsikringsregime

## 5. Personvern (GDPR)

IP-adresser, brukernavn og hash-er fra OT-syslog kan være personopplysninger. Deling mellom selvstendige behandlingsansvarlige uten avtale etter art. 26 og uten DPIA er en åpen flanke.

## 6. Konkurranserett

Kraftleverandører i samme marked som deler driftsdata i sanntid — uten klare regler for hva som *ikke* skal deles — kan komme i konflikt med konkurranseloven § 10. Statnett som TSO har dessuten en særstilling som krever ekstra varsomhet.

## 7. KraftCERT som "trust anchor" har ingen offentligrettslig myndighet

KraftCERT er en sektorforening, ikke et forvaltningsorgan. Å gjøre dem til den eneste utstederen av invite-tokens uten formell hjemmel skaper et legitimitetsproblem ved tvist — og ekskluderer NVE/RME/NSM som faktisk *har* hjemlene.

## 8. OpenAI-avhengigheten

Selv "planlagt" bruk av amerikansk AI-tjeneste til å korrelere kraftsensitive hendelser er en Schrems II-/CLOUD Act-felle. Bør være eksplisitt utelukket, eller begrenset til lokale modeller.

---

## Oppsummering

| # | Tema | Type risiko | Hva må gjøres |
|---|---|---|---|
| 1 | Kraftberedskapsforskriften | Regulatorisk | Klassifiseringslogikk, NVE-dialog |
| 2 | Sikkerhetsloven | Regulatorisk | Mekanisme for graderte data, eller eksplisitt avgrensning |
| 3 | NIS2 / digitalsikkerhetsloven | Regulatorisk | Vise samspill med lovpålagt varsling |
| 4 | Ansvar og hefting | Privatrettslig | Juridisk enhet + peering-avtale |
| 5 | GDPR | Personvern | Felles behandlingsansvar (art. 26), DPIA |
| 6 | Konkurranserett | Regulatorisk | Regler for hva som ikke deles |
| 7 | Trust anchor-legitimitet | Forvaltningsrettslig | Avklare rolle vs. NVE/RME/NSM |
| 8 | OpenAI-avhengighet | Personvern + sikkerhet | Lokal modell eller eksplisitt utelukkelse |
