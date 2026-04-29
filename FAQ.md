# Dette har vi tenkt på

Vi pitcher Nordlys (STK) på Krafthack 2026. En kritisk kraftbransje har gode grunner til å være skeptisk, og under er bekymringene vi forventer — sammen med valgene vi allerede har gjort for å møte dem. Dette er ikke en etterhåndsforklaring; det er designet slik det står i dag.

Lenker peker videre til [`README.md`](README.md) og [`docs/`](docs/) for dypdykk.

Innhold:

1. [Om Nordlys](#om-nordlys)
2. [Sikkerhet og trusselbilde](#sikkerhet-og-trusselbilde)
3. [Arkitektur og tillit](#arkitektur-og-tillit)
4. [Teknisk dybde](#teknisk-dybde)
5. [Drift, integrasjon og samsvar](#drift-integrasjon-og-samsvar)
6. [Demo og kjøring](#demo-og-kjøring)
7. [Bidrag og lisens](#bidrag-og-lisens)

---

## Om Nordlys

### Hva er Nordlys, og hvem er det for?
Nordlys (Security Toolkit, **STK**) er en desentralisert plattform for sanntids situasjonsforståelse i norsk kraftsektor. Den er bygget for kraftselskaper, nettoperatører og KraftCERT som trenger å koordinere sårbarheter, hendelser og indikatorer på tvers av selskapsgrenser uten å sende alt gjennom én sentral aktør. Se [README → Hva Nordlys er](README.md#hva-nordlys-er).

### Hvorfor desentralisert og ikke en sentral portal?
Vi har bevisst valgt bort den sentrale portalen. En sentral rapporteringsplattform er et attraktivt DoS-mål når et koordinert angrep treffer flere aktører samtidig. Glitrenett formulerte det selv: *«Det samler alt inn i ett felles system — utrolig gunstig for dem som har lyst til å ødelegge noe.»* Hver Nordlys-peer eier sin egen historikk, og meshen fortsetter å fungere selv om enkeltnoder — inkludert KraftCERT-noden — er nede.

### Hva skiller Nordlys fra MISP, OpenCTI eller en delt Teams-kanal?
Vi har sett på alternativene før vi bygde noe nytt. MISP og OpenCTI er gode IoC-databaser, men forutsetter en sentral instans og er ikke designet for OT-syslog eller for å overleve at trust-anchoren går ned. Teams og e-post mangler signering, deduplisering og strukturerte hendelser. Nordlys kombinerer signerte, gossipede hendelser med en kollektor som oversetter OT-syslog direkte til strukturerte events — alt på samme mesh-grunnmur.

### Er dette produksjonsklart?
Nei, og vi vil være tydelige på det: Nordlys er en **proof-of-concept for Krafthack 2026** og skal ikke kjøres mot ekte OT-utstyr. Veien videre er kartlagt — se [README → Status](README.md#status) for hva som er ferdig, under arbeid og listet som senere trinn.

---

## Sikkerhet og trusselbilde

### Hva har dere tenkt på i trusselmodellen?
Vi har gjennomført en STRIDE-analyse på arkitekturen. Spoofing og tampering er adressert med RSA-signering på alle events kombinert med KraftCERT-onboarding. Repudiation er adressert ved at hver hendelse er signert av kildenoden. De gjenværende reelle truslene — event-flooding (DoS) og LLM prompt injection i fritekstfelt — er beskrevet eksplisitt i [README → Trusselmodell](README.md#trusselmodell), sammen med mottiltakene som ligger i PoC-en i dag.

### Hva hindrer at en kompromittert peer sprer falske IoC-er eller flagger legitim trafikk som angrep?
Designet har fire lag mot dette. Først: alle events er signert, så avsenderen kan ikke skjules — en peer som sprer søppel er sporbar. Deretter er det per-scenario rate-cap, hop-limit (`MAX_HOPS=3`) og at scenario-pakker fra KraftCERT er signerte. Når mønsteret oppdages publiserer KraftCERT en revokering, og fra det øyeblikket avviser hver peer signaturer fra den kompromitterte noden. K-av-n-godkjenning av IoC-er er listet som neste trinn for å løfte terskelen ytterligere.

### Hvis vår node blir kompromittert, hvilke av våre data lekker da til hele meshen?
Kun det dere allerede har valgt å gossipe. Lokal SQLite-database, RSA-privatnøkkel og rå syslog fra OT-utstyret blir liggende på noden og lekker ikke automatisk. Kollektor-en er bevisst designet for å holde OT-rådata utenfor meshen — bare ferdig oversatte, strukturerte events får krysse grensen. Det er ingen «sync alt»-modus.

### Kan en konkurrent som er peer i meshen se vår sensitive informasjon?
Vi har vurdert dette eksplisitt. Alt som gossipes er per definisjon synlig for alle peers — det er ikke et privacy-system, og det skal det ikke være. Dere kontrollerer hva som forlater noden: kollektor-en oversetter til strukturerte felt med eksplisitte severity- og scenario-tagger, og fritekstkommentarer er valgfrie. TLP-merking og selektiv distribusjon (kun til KraftCERT, kun til navngitte peers) er listet under «Under arbeid (sprint 1)» i [README → Status](README.md#status).

### Hva hvis KraftCERT selv blir kompromittert?
Det er den verste enkeltfeilen i designet, og vi tar den på alvor. PoC-en mitigerer dette på tre måter: KraftCERT signerer ikke selve hendelsene, så en kompromittert KraftCERT kan ikke fabrikkere events i andres navn; eksisterende peers fortsetter å gossippe og verifisere som før; og scenario-pakker er signert separat. Det som åpnes er onboarding av nye, falske peers — derfor er invite-tokens kortlivede engangstokens. Multi-party trust (k-av-n) og HSM for KraftCERT-nøkkelen er listet som senere trinn.

### Hvordan håndteres event-flooding fra en støyende eller kompromittert peer?
Tre lag, designet sammen: per-peer rate limiting i gossip-loopen, per-scenario rate-cap på (kilde, scenario_id, severity) per time, og hop-counter (`MAX_HOPS=3`) som hindrer at events kan sirkulere uendelig. Kalibreringen er bevisst: meshen skal tåle en feilkonfigurert kollektor uten å miste reelle hendelser.

### Hvordan slipper vi løs nye deteksjonsregler uten å oversvømme meshen?
Vi har bygd inn en shadow-modus for nettopp dette. En eksperimentell scenario-regel evalueres mot innkommende syslog og logges lokalt, men hendelsene gossipes ikke til andre peers før dere har kalibrert reglen. Det fjerner risikoen for at en uvettig regel forplanter seg.

### Hva med LLM og prompt injection?
Vi har designet for at dette ikke skal være en angrepsflate. PoC-en gjør ingen aktive LLM-kall — AI-korrelering er en arkitekturplassholder. Designprinsippet er at fritekst fra events aldri går rett inn i en prompt; en eventuell LLM får strukturerte felt og må forholde seg til dem. Detaljer i [README → Trusselmodell](README.md#trusselmodell).

---

## Arkitektur og tillit

### Hvorfor er KraftCERT trust anchor, og hva skjer hvis KraftCERT-noden går ned?
Vi har bevisst gitt KraftCERT én avgrenset rolle: utstede kortlivede invite-tokens og føre revokeringslisten. Hvis KraftCERT-noden er nede, fortsetter alle eksisterende peers å gossippe events og verifisere signaturer som før — det eneste som stopper er onboarding av nye peers og publisering av nye revokeringer. Det er ingen «sentral kø» som tørker ut. Det er en eksplisitt designvalg, ikke en bivirkning.

### Hvordan onboardes en ny peer?
Onboarding-flyten er kjørbar end-to-end i PoC-en. KraftCERT utsteder et engangstoken via `POST /invite`. Den nye noden bytter tokenet mot identitet via `POST /register`, hvorved KraftCERT signerer peerens public key og kunngjør den til meshen som en vanlig hendelse. Hele flyten kan demonstreres med `app/demo-onboarding.sh`.

### Hva skjer hvis en node blir kompromittert?
Vi har bygd inn en tydelig revokeringsmekanisme. KraftCERT publiserer en signert revokering via `POST /revoke`. Revokeringen sprer seg gjennom meshen som en ordinær hendelse, og fra det øyeblikket den er mottatt avviser hver peer automatisk signaturer fra den revokerte noden. PoC-en bruker kun in-mesh revokeringsliste — OCSP/CRL og Certificate Transparency er listet som senere trinn i [README → Status](README.md#status).

### Hvem bestemmer hvem som får være med i meshen?
Designet legger denne myndigheten hos KraftCERT, i kraft av rollen som trust anchor. En produksjonsutrulling forutsetter at KraftCERT vedlikeholder onboarding-prosessen og publiserer kriteriene for hva som kvalifiserer som peer. Vi har bevisst latt PoC-en være taus om de organisatoriske prosessene rundt — det er en sektordialog, ikke et kodeproblem.

### Kan vi trekke oss ut av meshen, og hva skjer med dataene våre da?
Ja, og vi har tenkt gjennom konsekvensene. Å trekke seg ut betyr å slå av sin egen node. Lokal SQLite-database og privatnøkkel slettes lokalt, og KraftCERT publiserer en revokering slik at signaturer fra den gamle noden avvises. Hendelser dere tidligere har gossipet ligger fortsatt på de andre peernes lokale databaser — det er en bevisst konsekvens av at hver peer eier sin egen historikk, og samme egenskap som gjør meshen robust mot tap av enkeltnoder.

---

## Teknisk dybde

### Hvorfor RSA-2048 og ikke Ed25519 eller post-kvantum?
Vi har valgt RSA-2048 fordi `cryptography`-biblioteket gir batterier-inkludert støtte og fordi PKCS1v15 + SHA-256 matcher signaturformatet vi ønsker for scenario-pakker. Ed25519 er et naturlig neste steg, og post-kvantum-hybrid hører hjemme i en produksjonsutrulling sammen med IEC 62351 PKI. Det er ingen arkitektoniske bindinger til RSA — formatet ligger isolert i `app/backend/crypto.py` og kan byttes ut.

### Hvorfor SQLite og HTTP-polling i stedet for Postgres, websockets eller libp2p?
Driftsterskelen er det viktigste valget vi har tatt. SQLite gir én fil per node og null driftsoverhead — viktig for at en peer skal klare å starte sin egen node uten infra-team. HTTP push-pull hvert 10. sekund er enkelt å feilsøke, fungerer gjennom standard brannmurer, og det er enkelt å verifisere at meshen er konsistent. Et eventuelt skifte til websockets eller libp2p er allerede analysert i [`docs/TBD-TRANSPORT-ARKITEKTUR.md`](docs/TBD-TRANSPORT-ARKITEKTUR.md).

### Hva er en scenario-pakke, og hvem signerer den?
Scenario-pakker er KraftCERT-kuratert innhold, ikke fri programvare hver peer skriver selv. En pakke er en YAML-fil med deteksjonsregler, aggregeringsregler og MITRE ATT&CK-tagger — for eksempel `abb-relion.yaml` eller `generic-syslog-ot.yaml`. KraftCERT vedlikeholder og signerer pakkene med PKCS1v15 + SHA-256. I demoen kjører signaturkontrollen i «unsigned-ok»-modus; en produksjonsutrulling vil avvise usignerte pakker.

### Kan vi koble til vårt eget OT-utstyr?
Ja, så lenge det snakker syslog (RFC 5424 eller 3164) over UDP eller TCP. PoC-en støtter ikke OPC UA eller IEC 60870-5-104 ennå — disse er listet som senere trinn, ikke utelatt ved en feil. Konfigurasjonen ligger i `app/demo/kollektor-config/`.

### Hvordan legger vi til vår egen detektor uten å forstyrre meshen?
Skriv en scenario-YAML, plasser den under `app/backend/kollektor/scenarios/` og start den i shadow-modus. Lokal logg gir validering uten at hendelsene treffer andre peers. Når reglen oppfører seg som forventet, skrur dere av shadow-flagget og lar hendelsene gossipes. Det er den samme arbeidsflyten KraftCERT bruker når de utvider scenario-katalogen.

### Hvordan håndteres TLP-merking på indikatorer?
TLP-merking og IoC-gossiping er listet under «Under arbeid (sprint 1)» i [README → Status](README.md#status) — det er bevisst ikke i PoC-en ennå. I dag deles ikke indikatorer automatisk; manuelt opprettede events gossipes med samme signatur-stack som ordinære hendelser.

---

## Drift, integrasjon og samsvar

### Hvordan forholder Nordlys seg til NIS2, kraftberedskapsforskriften og sikkerhetsloven?
Vi er klare på hva Nordlys er og ikke er. Det er et koordineringsverktøy, ikke et samsvarsverktøy. Plattformen kan støtte NIS2-/digitalsikkerhetslov-rapportering ved å gi en strukturert hendelseslogg med signert kjede, men avløser ikke selve rapporteringsplikten til NSM, RME eller sektor-CSIRT. Strukturert «varslingsstatus» på hver hendelse, og eksport til myndighetsformater, er identifisert som leveranse for en produksjonsversjon — ikke implementert i PoC-en. Klassifisering etter kraftberedskapsforskriften og sikkerhetsloven er en organisatorisk vurdering den enkelte peer må gjøre før noe gossipes; PoC-en har ingen automatisert klassifisering, og skal ikke ha det uten at sektoren og NVE har tatt den dialogen. Vi gjør ingen autoritative tolkninger av lovverket her — full liste over identifiserte problemstillinger ligger i [README → Juridisk og regulatorisk](README.md#juridisk-og-regulatorisk--på-blokka).

### Hva slags informasjon kan i det hele tatt deles i Nordlys uten å bryte kraftberedskapsforskriften?
Det er nettopp den vurderingen som må gjøres av peer-en, med kvalifisert juridisk rådgivning og NVE-dialog, før produksjonsbruk. Vår foreløpige forutsetning er at Nordlys avgrenses til **ugradert og kraftsensitiv informasjon** der peer-en har dokumentert at delingen oppfyller kraftberedskapsforskriftens krav til behov-til-å-vite. Gradert informasjon etter sikkerhetsloven hører ikke hjemme i meshen og må håndteres på NSMs egne kanaler. PoC-en demonstrerer mekanikken; produksjonsutrulling forutsetter en NVE-godkjent klassifiseringsprofil og at deling er avskrudd som default for KBO-enheter inntil profilen er aktivert.

### Hvem hefter hvis en signert hendelse fra én peer leder en annen til å feilisolere en stasjon?
Dette er et reelt og uavklart spørsmål. PoC-en har ingen juridisk enhet bak seg, og open source-lisensen fritar utvikleren — den fritar ikke peer-en som signerer en feilaktig hendelse. En produksjonsutrulling forutsetter en sektorforening (eller tilsvarende juridisk enhet), en peering-avtale med ansvarsnorm og ansvarsbegrensning, og en kollektiv forsikringsordning. Et bærende prinsipp i en slik avtale bør være at **mottaker-peer har selvstendig handleplikt** — en signert ekstern hendelse er beslutningsstøtte, ikke ordre. Dette er på blokka, ikke løst.

### Forlater data Norge? Hva med GDPR?
Hver peer hoster sin egen node — datalokasjonen er deres eget valg, og inntil dere gossiper en hendelse forlater den ingen ting. IP-adresser, brukernavn og hash-er i events kan være personopplysninger, og det er den enkelte peers ansvar å vurdere behandlingsgrunnlag før de gossipes. Felles behandlingsansvar mellom peers og DPIA er ikke etablert i PoC-en — det forutsetter sektorforeningen og en formell Datatilsynet-dialog. Automatisk PII-sanitisering (pseudonymisering av brukernavn, stripping av interne IP-er) er identifisert som leveranse, ikke implementert. Vi vil hellere være ærlige enn å late som det er løst.

### Hva med konkurranserett — er det greit at kraftleverandører deler driftsdata i sanntid?
Det krever en eksplisitt vurdering. Nordlys deler sikkerhetshendelser og indikatorer, ikke kommersielt sensitive data som priser, volumer eller kundedata — det er en grunnleggende annen kategori. Likevel: en produksjonsutrulling bør ha en konkurranserettslig «do-not-share»-policy som teknisk filter, og en uttalelse fra Konkurransetilsynet bør hentes inn før utrulling. Statnetts TSO-rolle krever ekstra varsomhet. Dette er på blokka, ikke ferdig avklart.

### Er KraftCERT egentlig riktig trust anchor — har de hjemmel til denne rollen?
Trust anchor-rollen i Nordlys er **operativ koordinering**, ikke myndighetsutøvelse — på linje med funksjonen en root-CA har i en PKI. KraftCERT er valgt som bootstrap fordi de har sektortillit og kan operere uten å vente på regelverksendringer. Det er pragmatisk valg, ikke et endelig svar. En produksjonsversjon bør støtte **multi-anchor**: NVE, RME og NSM bør kunne delta som likestilte ankere der formell hjemmel kreves. PoC-en har én anchor; multi-anchor er identifisert som leveranse.

### Hvilken AI-leverandør brukes til korrelering, og hva med Schrems II / CLOUD Act?
Ingen aktive LLM-kall i PoC-en — AI-korrelering er en arkitekturplassholder. For en produksjonsversjon er forutsetningen at korreleringen kjører på **lokale modeller** eller EU-baserte tjenester uten amerikansk jurisdiksjonseksponering. Amerikanske skytjenester (OpenAI, Anthropic, Google direkte) er uakseptabelt for kraftsensitive eller sikkerhetsrelaterte data og vil bli eksplisitt utelukket. Dette er ikke ferdig kontraktsmessig avklart, men er et arkitekturprinsipp vi binder oss til.

### Vi har allerede mye SIEM-støy — kommer ikke Nordlys til å gjøre det verre?
Det er en reell bekymring, og vi har designet for å unngå det. Scenario-pakker er kuratert av KraftCERT — ikke en regel-sup fra hver peer — og per-scenario rate-cap demper en støyende kollektor. Nordlys er ikke en erstatning for SIEM; det er et lag for **sektor-koordinering** av hendelser dere allerede har vurdert som relevante. Selvbetjent regelproduksjon kjører i shadow-modus til den er kalibrert.

### Hvordan integrerer det mot vår eksisterende SIEM eller SOAR?
PoC-en eksponerer alle hendelser via `GET /events` og strukturert API. En SIEM/SOAR-integrasjon vil typisk være en pull-konsument som henter fra `/events/since/{iso}` med samme deduplisering som gossip-loopen. Webhooks og STIX/TAXII-eksport er listet som senere trinn — kjent gap, ikke et oversett.

### Hva koster det å drifte en node, og må vi ha 24/7-bemanning?
Vi har designet bevisst for lav driftsterskel. Selve noden er én container med SQLite — driftsbelastningen er minimal og krever ikke eget driftsteam. Behovet for 24/7-bemanning kommer ikke fra Nordlys, men fra hva dere bestemmer at en innkommende hendelse fra en annen peer skal trigge i deres egne rutiner. Det er en sektordialog vi anbefaler å ta tidlig.

### Hva er disaster recovery hvis vår node dør?
Tilstanden er bevisst minimal: SQLite-filen ligger på et persistent volum — backup av den filen pluss RSA-nøkkelen er tilstrekkelig. Hvis noden er borte for godt kan KraftCERT utstede en ny invite, og den nye noden henter historikk fra meshen via gossipens pull-mekanisme. Det er ingen sentral som må «restore-es».

---

## Demo og kjøring

### Hvilke avhengigheter trengs, og hvilke porter må være ledige?
Docker Desktop (eller `docker compose`), `python3` og `curl`. Demo-flyten bruker portene 8800, 8801, 8802 og 8888 (TCP) samt 5514 (UDP). Onboarding-demoen bruker 8000–8004. Full liste i [README → Kjør live-demoen](README.md#kjør-live-demoen-anbefalt-for-hackathon).

### Hva er forskjellen på `app/demo/run-demo.sh` og `app/demo-onboarding.sh`?
To compose-filer, to ulike formål. `run-demo.sh` starter angreps-demoen: KraftCERT, Hafslund, Statkraft, RTU-simulator og kollektor — designet for å vises live under presentasjonen. `demo-onboarding.sh` starter den fulle meshen (5 peers + 2 Varder) og verifiserer onboarding/revokering ende-til-ende.

### Hvor ser vi angrepet skje, og hvor lang tid tar det?
Hafslund (`http://localhost:8801`) viser events ankomme i sanntid. Statkraft (`http://localhost:8802`) viser de samme eventene 5–10 sekunder senere via gossip med Hafslunds signatur verifisert. Angreps-skriptet bruker rundt 3 minutter i naturlig tempo, eller noen sekunder med `--fast`. Detaljert tidslinje i [`app/demo/README.md`](app/demo/README.md).

### Hvordan rydder vi opp etterpå?
```bash
cd app/demo
docker compose -f docker-compose.demo.yml down -v
```
`-v` fjerner persistente volumer slik at neste demo starter med blanke ark.

### `permission denied` når vi kjører `.sh`-skriptene — hva nå?
Skriptene må være kjørbare:
```bash
chmod +x app/demo/run-demo.sh app/demo/attacker/exploit.sh app/demo-onboarding.sh
```

---

## Bidrag og lisens

### Hvordan kan vi som kraftselskap eller KraftCERT-ansatt bidra?
Kjør gjerne demoen lokalt og gi tilbakemelding på begreper, terskler og scenarioer som ikke matcher virkeligheten i deres selskap. Vi tar imot praktiske tilbakemeldinger best direkte i Krafthack-presentasjonen, eller via en issue i repoet.

### Hvilken lisens kjører prosjektet på?
Nordlys er lisensiert under [MIT-lisensen](LICENSE.md). Dere står fritt til å bruke, modifisere og distribuere koden, så lenge copyright-erklæringen følger med — bevisst valgt for å senere terskelen for at sektoren tar designet videre.

### Hvor diskuterer vi videre arkitektur?
[`docs/TBD-TRANSPORT-ARKITEKTUR.md`](docs/TBD-TRANSPORT-ARKITEKTUR.md) inneholder Varde-relay-designet med en «Åpne spørsmål for diskusjon»-seksjon (migrasjonsstrategi, mTLS, Varde-identitet, retensjon). Det er det riktige stedet å foreslå alternative valg.
