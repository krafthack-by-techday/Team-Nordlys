# Juridisk svar — slik adresserer STK innsigelsene

> **DISCLAIMER:** AI-generert research (Claude). Ment som
> utgangspunkt for diskusjon med jurist — ikke som juridisk
> rådgivning i seg selv.

> Notat fra claude-jurist med erfaring fra norsk kraftsektor, på STKs side.
> Underlag: `docs/juridisk-vurdering.md`.
> Skrevet 2026-04-29.

Innsigelsene er reelle, men de fleste handler om *rammeverk rundt* STK — ikke om selve mesh-arkitekturen. STK er et **teknisk verktøy for sektordeling**, ikke en erstatning for lovpålagt rapportering eller forvaltningsmyndighet. Når vi rammer det inn riktig, faller flere av innsigelsene bort, og resten kan løses med kjente avtale- og kontrollmekanismer.

Hovedlinjen i svaret:

1. **STK er en infrastruktur, ikke en beslutningsmyndighet.** Den deler signerte påstander mellom samtykkende peers — den klassifiserer ikke, gradér ikke, og den varsler ikke myndigheter på vegne av peer-en.
2. **Klassifisering og delingsbeslutning ligger hos avsenderen** — slik kbf. og sikkerhetsloven krever. STK håndhever beslutningen teknisk; den tar den ikke.
3. **Ansvarsmodellen formaliseres gjennom en sektorforening** med peering-avtale, slik vi kjenner fra Nordic RCC, ENTSO-E TP og eSett.

---

## 1. Kraftberedskapsforskriften — klassifisering før deling

**Innsigelsen:** Hendelsesdata er kraftsensitiv etter kbf. § 6-2; automatisk TLP-merking erstatter ikke skjønnet.

**Vårt svar:**

- STK gjør ingen automatisk klassifisering. Hver event opprettes med eksplisitt **sensitivitetsfelt** satt av operatøren (eller policy-regel hos peer-en), og noden nekter å gossipe events merket `KRAFTSENSITIV` ut over peer-grensen.
- TLP brukes kun *innenfor* delingsbeslutningen, som operasjonell håndteringsregel — ikke som rettslig grunnlag.
- Vi etablerer **NVE-dialog som leveranse i sprint 2**: STK leveres med en standard "klassifiseringsprofil" som NVE kan forhåndsgodkjenne, slik at peer-en har dokumentert behov-til-å-vite-vurdering før første event sendes. Profilen ligger i repo som versjonert YAML — auditerbar og reproduserbar.
- Default-konfig for KBO-enheter: **deling avskrudd inntil NVE-profil er aktivert**. Onboarding feiler lukket.

Resultat: kbf.-skjønnet ligger der det skal — hos peer-en, dokumentert, med NVE som tilsynsmyndighet over profilene.

## 2. Sikkerhetsloven — eksplisitt avgrensning

**Innsigelsen:** Mesh håndterer ikke graderte data; alt-eller-ingenting.

**Vårt svar:**

- STK avgrenses eksplisitt til **ugraderte og kraftsensitive data**. Graderte data etter sikkerhetsloven (BEGRENSET og oppover) håndteres på NSMs egne kanaler (NSM NCSC, sikker sone), ikke i STK.
- Dette er ikke en svakhet — det er **samme avgrensning som MISP, OpenCTI og alle sivile delingsplattformer** opererer under. Å bygge gradert-håndtering inn i en åpen mesh ville være feil arkitektur uansett.
- STK kan derimot **referere til** en gradert sak (sak-ID uten innhold) slik at peers vet at "noe pågår på NSM-siden" uten at innholdet lekker. Dette er en kjent pattern fra finanssektorens FS-ISAC.
- Demo-pitch oppdateres med eksplisitt scope-statement: *"STK håndterer ugradert og kraftsensitiv informasjon. Gradert informasjon etter sikkerhetsloven håndteres ikke i plattformen."*

## 3. NIS2 / digitalsikkerhetsloven — understøtter, erstatter ikke

**Innsigelsen:** STK kan skape parallell, uoffisiell varslingskanal.

**Vårt svar:**

- Vi legger til **"Varslingsstatus" som førsteklasses felt** på hver hendelse: `ikke_varslet`, `varslet_nsm`, `varslet_rme`, `varslet_sektor_csirt`, med tidsstempel og referanse-ID.
- Dashboardet får en egen widget *"Hendelser uten myndighetsvarsling > 24t"* som **minner peer-en på den lovpålagte plikten**. STK blir dermed et *compliance-verktøy* for NIS2/digsikkerhetsloven, ikke en omgåelse.
- Vi tilbyr **eksport-til-NSM-rapport** som genererer ferdig utfylt varsel (PDF/JSON) som operatøren kan sende videre. STK leverer dataene; mennesket sender varselet.
- Klar tekst i pitch og dokumentasjon: *"STK fritar ingen for varslingsplikt. STK gjør varslingsplikten lettere å oppfylle."*

## 4. Ansvar og hefting — sektorforening + peering-avtale

**Innsigelsen:** Ingen juridisk enhet bak "sektoren eier plattformen"; signaturansvar uavklart.

**Vårt svar:** Standardmodell fra europeisk kraftbransje:

- **Foreningsmodell:** "STK Sektorforum" (forening etter foreningsfrihetsprinsippet) eies av peer-ene. Lavt overhead, kjent struktur (jf. Energi Norge, Distriktsenergi).
- **Peering-avtale** mellom alle deltakere regulerer:
  - Aktsomhetsnorm for IoC-publisering (alminnelig god IT-sikkerhetspraksis)
  - **Ansvarsbegrensning til grov uaktsomhet og forsett** — peer-en hefter ikke for ordinære feilvurderinger gjort i god tro
  - Mottaker-peer har **selvstendig handleplikt**: signert IoC fra Hafslund er beslutningsstøtte, ikke ordre. Glitrenett som isolerer en stasjon utelukkende basert på en ekstern signatur har selv brutt aktsomhetsnormen.
  - Tvisteløsning: Oslo tingrett, norsk rett.
- **Forsikring:** sektorforeningen tegner kollektiv cyber-/profesjonsansvarsforsikring som dekker peer-ene for STK-aktivitet. Premien fordeles etter omsetning.
- **Open source-lisensen** (utvikler-fritak) og **peering-avtalen** (peer-ansvar) er to lag som virker sammen — det er ikke en kollisjon.

Dette er samme modell som ENTSO-E, Nordic RCC og eSett opererer under, og den er testet i kraftsektor-tvister.

## 5. GDPR — felles behandlingsansvar formaliseres

**Innsigelsen:** IP-er, brukernavn, hash-er kan være personopplysninger; ingen art. 26-avtale, ingen DPIA.

**Vårt svar:**

- **Felles DPIA** gjennomføres som leveranse av sektorforeningen før produksjonssetting. Mal er tilgjengelig fra Datatilsynets veileder for sektordeling.
- **Art. 26-avtale om felles behandlingsansvar** inngår som vedlegg til peering-avtalen. Roller, formål og registrerte-rettigheter klargjøres der.
- **Teknisk minimering i STK:**
  - Brukernavn pseudonymiseres ved publisering (hash-with-salt, salt deles bare i sektorforeningen)
  - IP-er kan markeres som "intern" og strippes før gossip
  - Sletteregime: events eldre enn definert retention (default 12 mnd, konfigurerbart per sensitivitetsnivå) slettes automatisk
- **Behandlingsgrunnlag:** GDPR art. 6(1)(f) berettiget interesse — sektorens og samfunnets interesse i å avverge alvorlige cyberangrep mot kritisk infrastruktur. Interesseavveiingen dokumenteres i DPIA-en.
- **Datatilsynet-dialog** parallelt med NVE-dialogen i sprint 2.

## 6. Konkurranserett — informasjonsdelingspolicy

**Innsigelsen:** Sanntidsdeling mellom konkurrenter kan bryte konkurranseloven § 10.

**Vårt svar:**

- STK deler **sikkerhetshendelser og IoC-er**, ikke kommersielt sensitive data (priser, volumer, kundedata, budstrategier). Det er en grunnleggende annen kategori enn det § 10 typisk rammer.
- **Konkurranserettslig "do-not-share"-liste** legges som teknisk filter i STK: events som inneholder felter som matcher kommersielle nøkkelord blokkeres ved publisering, med eksplisitt overstyring som krever to-personers godkjenning og logges.
- **Statnetts TSO-rolle:** Statnett deltar som "lytter" på linje med KraftCERT, ikke som en aktiv publiserende peer i kommersielle saker. Deres input gjelder systemkritiske hendelser der TSO-rollen er hjemlet i energiloven.
- Vi henter **ekstern uttalelse fra Konkurransetilsynet** som leveranse i sprint 2. Tilsvarende uttalelse er innhentet av FS-ISAC i finanssektoren — presedens finnes.

## 7. Trust anchor — KraftCERT er praktisk, ikke offentligrettslig

**Innsigelsen:** KraftCERT er ikke forvaltningsorgan; mangler hjemmel.

**Vårt svar:**

- Trust anchor-rollen er **operativ koordinering**, ikke myndighetsutøvelse. Det krever ingen særskilt hjemmel — det er samme funksjon som DigDir har for ID-porten brokering, eller som en root-CA har i PKI.
- **Multi-anchor fra dag én:** STK støtter flere parallelle trust anchors. KraftCERT er én. **NVE/RME, NSM NCSC og sektor-CSIRT-er** kan alle utstede invite-tokens. Peer-en velger hvilke anchors den anerkjenner i sin lokale konfig.
- **Myndighetene inviteres formelt** til å delta som anchors. Dersom NVE/RME ønsker å være eneanker for KBO-enheter, kan det konfigureres. STK gir myndighetene optionality, ikke ekskludering.
- KraftCERT er valgt som *bootstrap*-anchor fordi de har sektortillit i dag og kan operere uten å vente på regelverksendringer. Det er pragmatisk valg, ikke legitimitetsproblem.

## 8. OpenAI / amerikansk AI — fjernes fra arkitekturen

**Innsigelsen:** Schrems II + CLOUD Act gjør OpenAI uakseptabelt for kraftsensitive data.

**Vårt svar:** Enig, og vi strammer inn:

- **Eksplisitt forbud** mot at kraftsensitive eller sikkerhetsrelaterte data sendes til amerikanske skytjenester. Tas inn som arkitekturprinsipp og som teknisk policy-regel.
- AI-korrelering utføres med **lokale modeller** (Ollama/llama.cpp på peer-ens egen infrastruktur, eller modeller hostet i EU-skyer med dataresidens-garanti og uten CLOUD Act-eksponering — typisk norske/europeiske leverandører som Nebius, OVH, eller dedikert on-prem GPU).
- For peers uten kapasitet kan **sektorforeningen drive en delt AI-node** i norsk datasenter, dedikert maskinvare, kontraktuelt utenfor amerikansk jurisdiksjon.
- Pitch og dokumentasjon oppdateres: OpenAI-referansene fjernes; lokal/EU-AI nevnes som det eneste alternativet.

---

## Konsolidert handlingsplan

| # | Leveranse | Når | Eier |
|---|---|---|---|
| 1 | Klassifiseringsprofil + NVE-dialog | Sprint 2 | Sektorforening + NVE |
| 2 | Scope-statement: ugradert/kraftsensitiv | Sprint 1 (pitch) | Team Nordlys |
| 3 | Varslingsstatus-felt + NSM-eksport | Sprint 1 | Team Nordlys |
| 4 | Sektorforening + peering-avtale + forsikring | Pre-prod | Sektorforening |
| 5 | Felles DPIA + art. 26-avtale + Datatilsynet-dialog | Sprint 2 | Sektorforening |
| 6 | Konkurranserettslig filter + Konkurransetilsynet-uttalelse | Sprint 2 | Sektorforening |
| 7 | Multi-anchor-støtte + invitasjon til NVE/RME/NSM | Sprint 1 | Team Nordlys |
| 8 | Fjerne OpenAI; lokal/EU-AI som arkitekturprinsipp | Sprint 1 (pitch) | Team Nordlys |

**Hovedbudskap til pitch-juryen:** STK er bygd så det *passer inn i* den regulatoriske strukturen kraftbransjen allerede har — det erstatter den ikke. Innsigelsene over er ikke arkitekturproblemer; de er det normale rammeverket en sektorplattform må operere innenfor, og vi har konkrete leveranser for hvert punkt.
