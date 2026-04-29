"""ABB Relion 615-simulator for STK-demo.

Etterligner web-HMI'et til et eksponert vernrelé. Hver autentiserings-handling,
setpunkt-endring og firmware-operasjon emitterer en RFC 3164 syslog-melding mot
en konfigurert kollektor. Meldingsformatet matcher abb-relion-scenario-pakken.

ADVARSEL: Dette er en *demo*. Default-credsene er innebygde og dokumenterte.
Skal aldri eksponeres mot fysisk nett eller produksjons-DMZ.
"""

from __future__ import annotations

import logging
import os
import socket
import time
from dataclasses import dataclass
from flask import Flask, request, jsonify, render_template_string, session, redirect

app = Flask(__name__)
app.secret_key = "demo-rtu-key-do-not-use-in-prod"

DEVICE_ID = os.environ.get("RTU_DEVICE_ID", "RELION615")
SYSLOG_HOST = os.environ.get("SYSLOG_HOST", "127.0.0.1")
SYSLOG_PORT = int(os.environ.get("SYSLOG_PORT", "5514"))
DEFAULT_USER = os.environ.get("RTU_USER", "admin")
DEFAULT_PASS = os.environ.get("RTU_PASS", "admin")

log = logging.getLogger("rtu-sim")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

_state = {"voltage_setpoint": "1.00", "current_setpoint": "5.00", "firmware_version": "2.4.1"}


# ── Syslog emitter ─────────────────────────────────────────────────────────
# RFC 3164 over UDP. Facility/severity packed into <PRI> = facility*8 + severity.
# We use facility=16 (local0). Severity varies: 2=critical, 3=error, 4=warning, 6=info.

_FACILITY = 16

def _emit(severity: int, line: str) -> None:
    pri = _FACILITY * 8 + severity
    ts = time.strftime("%b %d %H:%M:%S", time.localtime())
    msg = f"<{pri}>{ts} {DEVICE_ID} {line}"
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.sendto(msg.encode("utf-8"), (SYSLOG_HOST, SYSLOG_PORT))
        log.info("syslog: %s", line)
    except Exception as e:
        log.warning("syslog send failed: %s", e)


def _peer_ip() -> str:
    return request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()


# ── HTML ───────────────────────────────────────────────────────────────────

LOGIN_HTML = """
<!doctype html><html><head><title>ABB Relion 615 — Web HMI</title>
<style>
body{background:#1a1d24;color:#d4d4d4;font-family:'Segoe UI',sans-serif;margin:0}
.bar{background:#dc2626;color:white;padding:8px 16px;font-weight:600;letter-spacing:.05em}
.bar small{font-weight:400;opacity:.8}
.box{max-width:380px;margin:80px auto;background:#252830;border:1px solid #3a3d45;border-radius:4px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,.4)}
h1{color:#dc2626;font-size:18px;margin:0 0 4px;letter-spacing:.05em}
.sub{color:#888;font-size:11px;margin:0 0 24px;text-transform:uppercase;letter-spacing:.1em}
label{display:block;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.08em;margin:14px 0 4px}
input{width:100%;padding:8px 10px;background:#1a1d24;border:1px solid #3a3d45;color:#fff;font-family:monospace;border-radius:2px;box-sizing:border-box}
button{margin-top:18px;width:100%;padding:10px;background:#dc2626;color:white;border:none;font-weight:600;letter-spacing:.05em;cursor:pointer;border-radius:2px}
button:hover{background:#b91c1c}
.fw{margin-top:14px;font-size:11px;color:#666;font-family:monospace}
.err{color:#f87171;font-size:12px;margin-top:8px}
</style></head><body>
<div class="bar">ABB <small>· Relion® 615 series · Feeder Protection</small></div>
<div class="box">
<h1>WEB HMI LOGIN</h1>
<p class="sub">Device: {{ device }} · v2.4.1</p>
<form method="post" action="/login">
<label>USERNAME</label><input name="user" autofocus>
<label>PASSWORD</label><input name="pass" type="password">
{% if error %}<div class="err">{{ error }}</div>{% endif %}
<button>SIGN IN</button>
</form>
<div class="fw">Default credentials apply on first install. Refer to manual section 4.2.</div>
</div></body></html>
"""

CONSOLE_HTML = """
<!doctype html><html><head><title>{{ device }} — Console</title>
<style>
body{background:#1a1d24;color:#d4d4d4;font-family:monospace;margin:0;padding:24px}
.bar{background:#dc2626;color:white;padding:8px 16px;font-weight:600;margin:-24px -24px 24px}
h2{color:#dc2626;margin-top:0}
.row{display:flex;gap:24px;margin:8px 0}
.k{color:#888;width:200px}
.v{color:#86efac}
form{margin-top:24px}
input,button{padding:6px 10px;background:#252830;border:1px solid #3a3d45;color:#fff;font-family:monospace}
button{background:#dc2626;border-color:#dc2626;cursor:pointer}
</style></head><body>
<div class="bar">ABB Relion 615 · {{ user }}@{{ device }}</div>
<h2>Device State</h2>
<div class="row"><div class="k">Voltage setpoint (pu)</div><div class="v">{{ state.voltage_setpoint }}</div></div>
<div class="row"><div class="k">Current setpoint (A)</div><div class="v">{{ state.current_setpoint }}</div></div>
<div class="row"><div class="k">Firmware version</div><div class="v">{{ state.firmware_version }}</div></div>
<form method="post" action="/api/setpoint" enctype="application/x-www-form-urlencoded">
  <h2>Change setpoint</h2>
  Param: <input name="param" value="voltage" size="12">
  New value: <input name="new" value="0.85" size="8">
  <button>APPLY</button>
</form>
<form method="post" action="/api/firmware/upload" enctype="multipart/form-data">
  <h2>Firmware upload</h2>
  <input type="file" name="file"><button>UPLOAD</button>
</form>
</body></html>
"""

# ── Routes ─────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if session.get("user"):
        return render_template_string(CONSOLE_HTML, device=DEVICE_ID, user=session["user"], state=_state)
    return render_template_string(LOGIN_HTML, device=DEVICE_ID, error=None)


@app.route("/login", methods=["POST"])
def login():
    user = request.form.get("user", "")
    pw = request.form.get("pass", "")
    src = _peer_ip()

    if user == DEFAULT_USER and pw == DEFAULT_PASS:
        session["user"] = user
        _emit(6, f"web: authentication SUCCESS user={user} source={src}")
        return redirect("/")
    _emit(4, f"web: authentication failure user={user} source={src}")
    return render_template_string(LOGIN_HTML, device=DEVICE_ID, error="Invalid credentials"), 401


@app.route("/api/ssh-attempt", methods=["POST"])
def ssh_attempt():
    """Simulate SSH login for demo realism without running a real SSH server."""
    body = request.get_json(silent=True) or {}
    user = body.get("user", "")
    pw = body.get("password", "")
    src = body.get("source", _peer_ip())

    if user == DEFAULT_USER and pw == DEFAULT_PASS:
        _emit(6, f"sshd: Accepted password for {user} from {src}")
        return jsonify({"accepted": True, "shell": f"{user}@{DEVICE_ID}#"}), 200
    _emit(4, f"sshd: Failed password for {user} from {src}")
    return jsonify({"accepted": False}), 401


@app.route("/api/setpoint", methods=["POST"])
def setpoint():
    if not session.get("user"):
        return jsonify({"error": "auth required"}), 401
    user = session["user"]
    src = _peer_ip()
    if request.is_json:
        body = request.get_json() or {}
        param = body.get("param", "voltage")
        new = str(body.get("new", body.get("voltage", "")))
    else:
        param = request.form.get("param", "voltage")
        new = request.form.get("new", "")
    old = _state.get(f"{param}_setpoint", "?")
    _state[f"{param}_setpoint"] = new
    _emit(2, f"control: setpoint {param} changed {old} -> {new} by user={user} from={src}")
    if request.is_json:
        return jsonify({"param": param, "old": old, "new": new}), 200
    return redirect("/")


@app.route("/api/firmware/upload", methods=["POST"])
def firmware():
    if not session.get("user"):
        return jsonify({"error": "auth required"}), 401
    user = session["user"]
    src = _peer_ip()
    fname = "unknown"
    if "file" in request.files:
        fname = request.files["file"].filename or "unknown"
    elif request.is_json:
        fname = (request.get_json() or {}).get("filename", "unknown")
    _emit(2, f"firmware: upload started by user={user} from={src} file={fname}")
    if request.is_json:
        return jsonify({"status": "uploaded", "file": fname}), 200
    return redirect("/")


@app.route("/api/status")
def status():
    return jsonify({"device": DEVICE_ID, "state": _state, "authenticated": bool(session.get("user"))})


@app.route("/health")
def health():
    return jsonify({"ok": True, "device": DEVICE_ID})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    log.info("RTU-sim %s starting — syslog → %s:%d", DEVICE_ID, SYSLOG_HOST, SYSLOG_PORT)
    log.info("DEFAULT CREDS (DEMO ONLY): %s / %s", DEFAULT_USER, DEFAULT_PASS)
    app.run(host="0.0.0.0", port=port, debug=False)
