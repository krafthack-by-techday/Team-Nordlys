"""STK kollektor — sidecar som oversetter OT-signaler til signerte node-events.

Kjøres som egen prosess ved siden av en STK-node, ikke innebygd. Holder
protokoll-stacker (syslog, MQTT, IEC 104, ...) utenfor signerings-prosessen i
noden — det realistiske DMZ-mønsteret.
"""
