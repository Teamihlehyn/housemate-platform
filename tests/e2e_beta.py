"""End-to-end checks for beta mode (ENG-10): gating, safety, invite-only sign-up, the full
member journey, feedback, survey opt-in/send/unsubscribe, export and deletion.

Usage:
  python3 tests/e2e_beta.py http://localhost:3100 "postgresql://<you>@localhost:5432/<beta_test_db>"

Needs a LOCAL beta-mode server and a psql connection string for the same database. The
script runs a fake Resend on 127.0.0.1:$MAIL_PORT (default 8025) and reads the emails the
app sends, so start the server with:
  APP_ENV=beta NEXT_PUBLIC_APP_ENV=beta OPEN_CITIES=lagos \
  RESEND_API_KEY=test-key EMAIL_FROM="Peabudy <test@example.com>" EMAIL_API_URL=http://127.0.0.1:8025 \
  DATABASE_URL=… DIRECT_URL=… next dev -p 3100
(EMAIL_API_URL is honoured only outside Vercel.) Some setup still goes straight to the
database: codes for pre-made members, invites for them, roles. Never point this at a shared
or cloud database.
"""
import datetime, hashlib, http.cookiejar, http.server, json, os, random, re, subprocess, sys, threading, time
import urllib.error, urllib.parse, urllib.request, uuid

BASE, PSQL = sys.argv[1], sys.argv[2]
if "neon.tech" in PSQL or "localhost" not in PSQL:
    sys.exit("Refusing to run: e2e_beta.py writes directly to the database; use a local one.")
fails = 0
RUN = datetime.datetime.now().strftime("%H%M%S%f")
today = datetime.date.today()


# ---- fake Resend: collects every email the app sends ----
MAIL = []
MAIL_PORT = int(os.environ.get("MAIL_PORT", "8025"))


class FakeResend(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        MAIL.append(body)
        out = json.dumps({"id": uuid.uuid4().hex}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *a):
        pass


threading.Thread(target=http.server.ThreadingHTTPServer(("127.0.0.1", MAIL_PORT), FakeResend).serve_forever, daemon=True).start()


def mails_to(addr):
    return [m for m in MAIL if addr in m.get("to", [])]


def wait_mail(addr, pred=lambda m: True, timeout=10):
    end = time.time() + timeout
    while time.time() < end:
        found = [m for m in mails_to(addr) if pred(m)]
        if found:
            return found[-1]
        time.sleep(0.1)
    return None


def login_code(addr):
    m = wait_mail(addr, lambda m: "sign-in code" in m.get("subject", ""))
    return re.search(r"(\d{6})", m["subject"]).group(1) if m else None


_ip = iter(range(1, 60000))
NET = random.randint(1, 250)


def next_ip():  # a fresh client IP per call keeps the per-IP limits out of the way
    i = next(_ip)
    return f"10.{NET}.{i // 250}.{i % 250 + 1}"


class C:
    def __init__(self):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.headers = {}

    def call(self, path, body=None, method=None, ip=None):
        headers = {"Content-Type": "application/json"}
        if ip:  # local dev only: next dev trusts x-forwarded-for, so tests can pick the client IP
            headers["X-Forwarded-For"] = ip
        req = urllib.request.Request(
            BASE + "/api/v1" + path,
            data=json.dumps(body).encode() if body is not None else None,
            method=method or ("POST" if body is not None else "GET"),
            headers=headers,
        )
        try:
            with self.op.open(req, timeout=60) as r:
                self.headers = {k.lower(): v for k, v in r.headers.items()}
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            self.headers = {k.lower(): v for k, v in e.headers.items()}
            try:
                return e.code, json.loads(e.read().decode())
            except Exception:
                return e.code, {}

    def raw(self, path, method="GET"):
        req = urllib.request.Request(BASE + path, method=method)
        try:
            with self.op.open(req, timeout=60) as r:
                return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read().decode()
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode()


def check(name, cond, extra=""):
    global fails
    print(("  PASS " if cond else "  FAIL ") + name + (f"  ({extra})" if extra else ""))
    if not cond:
        fails += 1


def sql(q):
    return subprocess.check_output(["psql", PSQL, "-tAc", q], text=True).strip()


def lit(s):
    return "'" + s.replace("'", "''") + "'"


ALPHABET = "ABCDEFGHJKMNPQRSTWXYZ23456789"


def sql_invite(email=None, expires="now() + interval '14 days'"):
    """An invite made straight in the database; returns (id, code)."""
    code = "".join(random.choice(ALPHABET) for _ in range(8))
    iid = uuid.uuid4().hex
    sql(f'''insert into "Invite"(id, "codeHash", email, "createdBy", "expiresAt")
           values ({lit(iid)}, {lit(hashlib.sha256(code.encode()).hexdigest())}, {lit(email) if email else "null"}, 'e2e', {expires})''')
    return iid, code


def new_code(email, invite_id=None):
    code = "246810"
    sql(f'''insert into "AuthCode"(id, email, code, "inviteId", "expiresAt") values ({lit(uuid.uuid4().hex)}, {lit(email)}, {lit(code)},
           {lit(invite_id) if invite_id else "null"}, now() + interval '10 minutes')''')
    return code


def user_id(email):
    return sql(f'select id from "User" where email = {lit(email)}')


def set_identity(uid, status):
    sql(f'update "VerificationCheck" set status = {lit(status)} where "userId" = {lit(uid)} and category = \'identity\'')


d = lambda r: r[1].get("data") or {}
err = lambda r: (r[1].get("error") or {}).get("code")


def member(name, area, city="london"):
    c, email = C(), f"beta-{name}-{RUN}@example.com"
    iid, _ = sql_invite(email)
    r = c.call("/auth/verify-code", {"email": email, "code": new_code(email, iid), "accept_privacy": True})
    assert r[0] == 200, r
    c.call("/me/profile", {"journey": "find_together", "displayName": name.title(),
                           "bio": "Beta end-to-end test member with a bio comfortably over the eighty character minimum."}, method="PATCH")
    money = {"rentPeriod": "month", "rentMinMinor": 80000, "rentMaxMinor": 120000} if city == "london" else \
        {"rentPeriod": "year", "rentMinMinor": 150000000, "rentMaxMinor": 250000000}
    c.call("/me/search", {"cityId": city, "areaIds": [area], **money,
                          "moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(),
                          "latestDate": (today + datetime.timedelta(days=50)).isoformat(), "stayMinMonths": 6, "stayMaxMonths": 12}, method="PATCH")
    habits = {"cleaning": "weekly", "quiet": "before_00", "guests": "up_to_2_nights", "smoking": "no", "pets": "none", "social": "balanced"}
    c.call("/me/search", {"gender": "prefer_not_to_say",
                          "preferences": [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in habits.items()]}, method="PATCH")
    r = c.call("/me/search/publish", {})
    assert r[0] == 200, r
    return c, email, user_id(email)


print("== Beta mode is on ==")
probe = f"beta-probe-{RUN}@example.com"
_, probe_code = sql_invite(probe)
r = C().call("/auth/request-code", {"email": probe, "invite_code": probe_code}, ip=next_ip())
check("no on-screen code in beta; the code is emailed", r[0] == 200 and not d(r).get("sink_code") and login_code(probe), f"{r[0]} {err(r)}")
if r[0] == 200 and not mails_to(probe):
    sys.exit(f"The server isn't sending mail to the fake Resend on :{MAIL_PORT}. Start it with EMAIL_API_URL=http://127.0.0.1:{MAIL_PORT}, RESEND_API_KEY and EMAIL_FROM.")
check("demo personas are off", C().call("/auth/demo-persona", {"persona": "ben", "accept_privacy": True})[0] == 404)

print("== ENG-02: verified-only browsing ==")
a, a_email, a_id = member("ada", "hackney")
b, b_email, b_id = member("bea", "hackney")
check("published members start in manual review", sql(f'select status from "VerificationCheck" where "userId" = {lit(a_id)} and category = \'identity\'') == "manual_review")
r = a.call("/recommendations")
check("pending viewer sees no candidates", r[0] == 200 and d(r)["candidates"] == [] and d(r).get("gate") == "identity_pending", r)

set_identity(b_id, "verified")
missing = a.call("/users/does-not-exist")
r = a.call("/users/" + b_id)
check("pending viewer gets 404 on a verified profile", r[0] == 404 and r[1]["error"] == missing[1]["error"], r[1].get("error"))
r = b.call("/users/" + a_id)
check("verified viewer can't see an unverified profile", r[0] == 404 and err(r) == "NOT_FOUND")
r = b.call("/recommendations")
check("verified viewer isn't shown unverified people", a_id not in [c["userId"] for c in d(r).get("candidates", [])] and d(r).get("gate") is None)

set_identity(a_id, "verified")
check("two verified members see each other",
      b_id in [c["userId"] for c in d(a.call("/recommendations"))["candidates"]]
      and a_id in [c["userId"] for c in d(b.call("/recommendations"))["candidates"]])
check("verified members can open each other's profile", a.call("/users/" + b_id)[0] == 200)

print("== ENG-01: homes, viewings, application and move-in are off ==")
routes = [("GET", "/properties"), ("POST", "/households/x/shortlist"), ("POST", "/shortlist/x/vote"),
          ("POST", "/households/x/viewings"), ("POST", "/viewings/x"), ("POST", "/households/x/handoffs"),
          ("POST", "/handoffs/x"), ("POST", "/households/x/move-in")]
for method, path in routes:
    body = {} if method == "POST" else None
    anon = C().call(path, body, method)
    signed = a.call(path, body, method)
    check(f"{method} {path}: 401 signed out, 404 signed in", anon[0] == 401 and signed[0] == 404 and err(signed) == "NOT_FOUND",
          f"{anon[0]}/{signed[0]}")
check("households/current still works", a.call("/households/current")[0] == 200)

INTRO = "Hello, our dates and areas line up well. Shall we talk about a place?"


def verified_member(name):
    c, email, uid = member(name, "hackney")
    set_identity(uid, "verified")
    return c, email, uid


def notes(c):
    return len(d(c.call("/notifications")).get("notifications", []))


print("== HM-01: sender identity is checked first ==")
p_, _, _ = member("pending", "hackney")
r1 = p_.call("/introductions", {"target_user_id": "does-not-exist", "text": INTRO})
r2 = p_.call("/introductions", {"target_user_id": b_id, "text": INTRO})
check("pending sender gets the same answer for a real and a missing target",
      r1[0] == r2[0] == 403 and err(r1) == err(r2) == "IDENTITY_PENDING", f"{r1[0]}/{r2[0]}")

print("== HM-02: a block can't be bypassed ==")
c, _, c_id = verified_member("cal")
dd, _, d_id = verified_member("dee")
check("intro sent (Dee → Cal)", dd.call("/introductions", {"target_user_id": c_id, "text": INTRO})[0] == 200)
intro_cd = d(c.call("/introductions?direction=incoming"))["introductions"][0]
check("Dee blocks Cal", dd.call("/blocks", {"target_user_id": c_id})[0] == 200)
check("block ends the pending intro", sql(f'select state || \'/\' || "reasonCode" from "Introduction" where id = {lit(intro_cd["id"])}') == "expired/blocked")
before = notes(dd)
r = c.call(f"/introductions/{intro_cd['id']}", {"action": "accept"})
check("block → accept is 404", r[0] == 404 and err(r) == "NOT_FOUND", f"{r[0]} {err(r)}")
check("no conversation opened", sql(f'select count(*) from "Conversation" where "introductionId" = {lit(intro_cd["id"])}') == "0")
check("blocker gets no notification (accept)", notes(dd) == before)

e, _, e_id = verified_member("eve")
f, _, f_id = verified_member("fay")
check("intro sent (Eve → Fay)", e.call("/introductions", {"target_user_id": f_id, "text": INTRO})[0] == 200)
intro_ef = d(f.call("/introductions?direction=incoming"))["introductions"][0]
r = f.call(f"/introductions/{intro_ef['id']}", {"action": "accept"})
check("Fay accepts", r[0] == 200, r[1].get("error"))
convo = d(r).get("conversationId")
check("Fay blocks Eve", f.call("/blocks", {"target_user_id": e_id})[0] == 200)
before = notes(f)
r = e.call("/households", {"introduction_id": intro_ef["id"], "plan": {}})
check("accept → block → propose household is 404", r[0] == 404 and err(r) == "NOT_FOUND", f"{r[0]} {err(r)}")
r = e.call(f"/conversations/{convo}/messages", {"client_message_id": "m1", "body": "hello again"})
check("blocked person can't message: 404", r[0] == 404, f"{r[0]} {err(r)}")
check("blocker gets no notification (household, message)", notes(f) == before)

from concurrent.futures import ThreadPoolExecutor

print("== HM-03: parallel guesses can't beat the attempt cap ==")
from concurrent.futures import ThreadPoolExecutor
g_email = f"beta-guess-{RUN}@example.com"
new_code(g_email)
with ThreadPoolExecutor(max_workers=50) as pool:
    results = list(pool.map(lambda i: C().call("/auth/verify-code", {"email": g_email, "code": "000000", "accept_privacy": True}), range(50)))
evaluated = sum(1 for r in results if err(r) == "INVALID_CODE")
check("50 concurrent wrong guesses: at most 5 evaluated", evaluated <= 5 and all(err(r) in ("INVALID_CODE", "TOO_MANY_ATTEMPTS") for r in results), f"evaluated={evaluated}")
for _ in range(2):
    new_code(g_email)
    for _ in range(5):
        C().call("/auth/verify-code", {"email": g_email, "code": "000000", "accept_privacy": True})
code = new_code(g_email)
r = C().call("/auth/verify-code", {"email": g_email, "code": code, "accept_privacy": True})
check("10 failed guesses an hour locks the address, even with a fresh correct code", r[0] == 429 and err(r) == "TOO_MANY_ATTEMPTS", f"{r[0]} {err(r)}")

print("== HM-08: emailed code requests are capped per IP ==")
codes = [C().call("/auth/request-code", {"email": f"beta-cap{i}-{RUN}@example.com"}) for i in range(12)]
first_429 = next((i for i, r in enumerate(codes) if r[0] == 429), None)
check("an IP is capped within 11 requests an hour", first_429 is not None and first_429 <= 10 and err(codes[first_429]) == "RATE_LIMITED", f"first 429 at #{first_429}")

print("== HM-08: IPv6 is capped per /64 ==")
net = f"2001:db8:{int(RUN[-4:]) % 65536:x}:{int(RUN[:4]) % 65536:x}"
v6 = [C().call("/auth/request-code", {"email": f"beta-v6-{i}-{RUN}@example.com"}, ip=f"{net}::{i + 1:x}") for i in range(11)]
check("10 addresses in one /64 share a cap", all(r[0] != 429 for r in v6[:10]) and v6[10][0] == 429 and err(v6[10]) == "RATE_LIMITED",
      [r[0] for r in v6])
r = C().call("/auth/request-code", {"email": f"beta-v6-other-{RUN}@example.com"}, ip=f"2001:db8:ffff:{int(RUN[:4]) % 65536:x}::1")
check("another /64 isn't affected", r[0] != 429, f"{r[0]} {err(r)}")

print("== HM-08: a burst can't beat the per-email cap ==")
burst_email = f"beta-burst-{RUN}@example.com"
_, burst_invite = sql_invite(burst_email)
with ThreadPoolExecutor(max_workers=20) as pool:
    burst = list(pool.map(lambda i: C().call("/auth/request-code", {"email": burst_email, "invite_code": burst_invite}, ip=f"198.51.100.{i + 1}"), range(20)))
made = int(sql(f'select count(*) from "AuthCode" where email = {lit(burst_email)}'))
check("20 parallel requests for one address create at most 5 codes", made == 5, f"codes={made}, statuses={sorted(r[0] for r in burst)}")

print("== HM-26: over the site-wide cap, everyone gets the same honest 429 ==")
BUSY = "We're getting a lot of sign-in requests right now. Try again in an hour."
fill = f"e2e-fill-{RUN}"
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       select {lit(fill)} || g, 'auth.code_requested', 'service', 'ip', {lit(fill)} || g, 'email', 'allowed', now()
       from generate_series(1, 300) g''')
flood_c, m_email, _ = member("flood", "camden")
cm = C()
t0 = time.time()
r = cm.call("/auth/request-code", {"email": m_email}, ip="192.0.2.10")
took = time.time() - t0
check("member over the site-wide cap: 429 RATE_LIMITED with the agreed message",
      r[0] == 429 and err(r) == "RATE_LIMITED" and r[1]["error"]["message"] == BUSY, r)
check("…with Retry-After", cm.headers.get("retry-after") == "3600", cm.headers.get("retry-after"))
check("…after the 150–500 ms jitter", took >= 0.15, f"{took:.3f}s")
check("…and no code is created or sent", sql(f'select count(*) from "AuthCode" where email = {lit(m_email)}') == "0" and not mails_to(m_email))
check("…and the refusal is logged", sql(f'''select count(*) from "AuditEvent" where "eventType" = 'auth.code_requested' and action = 'dropped_sitewide_cap' and "occurredAt" > now() - interval '1 minute' ''') != "0")
r = C().call("/auth/request-code", {"email": f"beta-floodnew-{RUN}@example.com"}, ip="192.0.2.12")
check("a new address without an invite still gets INVITE_REQUIRED (no new signal)", err(r) == "INVITE_REQUIRED", f"{r[0]} {err(r)}")
staff_c, staff_email, staff_id = member("staffer", "camden")
sql(f'update "User" set role = \'verifier\' where id = {lit(staff_id)}')
cs = C()
r = cs.call("/auth/request-code", {"email": staff_email}, ip="192.0.2.11")
check("staff over the cap get the identical 429…", r[0] == 429 and err(r) == "RATE_LIMITED" and r[1]["error"]["message"] == BUSY and cs.headers.get("retry-after") == "3600", r)
check("…but their code is created and emailed", sql(f'select count(*) from "AuthCode" where email = {lit(staff_email)}') == "1" and login_code(staff_email))
sql(f'delete from "AuditEvent" where "resourceId" like {lit(fill + "%")}')

print("== ENG-04: beta shows checks, never a score ==")
r = b.call("/users/" + a_id)
cred = d(r).get("credibility", {})
check("public profile has only the checks list", r[0] == 200 and set(cred.keys()) == {"checks"}, cred)
cats = {c["category"]: c for c in cred.get("checks", [])}
check("email and identity are listed with a month, not a timestamp",
      {"email", "identity"} <= set(cats) and all(len(c["checkedMonth"]) == 7 and c["checkedMonth"][4] == "-" for c in cats.values()), cats)
check("no score anywhere in the profile JSON", "/100" not in json.dumps(d(r)) and '"score"' not in json.dumps(d(r)))
recs = d(b.call("/recommendations"))["candidates"]
check("recommendations carry idChecked, not a score", recs and all(c.get("idChecked") is True and "score" not in c for c in recs))
me = d(p_.call("/me")).get("credibility", {})
check("own /me: no score; pending identity shown as pending",
      set(me.keys()) == {"checks"} and any(c["category"] == "identity" and c["status"] == "pending" for c in me["checks"]), me)
p_id = user_id(sql(f'select email from "User" where email like {lit("beta-pending-" + RUN + "%")}'))
sql(f'update "VerificationCheck" set "checkedAt" = \'2026-01-15\' where "userId" = {lit(p_id)} and category = \'identity\'')
r = staff_c.call(f"/staff/verifications/{p_id}", {"action": "approve"})
check("staff approval works", r[0] == 200, r[1].get("error"))
check("approval dates the identity check to the approval, not the publish",
      sql(f'select to_char("checkedAt", \'YYYY-MM\') from "VerificationCheck" where "userId" = {lit(p_id)} and category = \'identity\'')
      == datetime.datetime.utcnow().strftime("%Y-%m"))
check("staff approval response has no score", "score" not in json.dumps(d(r)), d(r))

print("== ENG-01: plan.propertyId is ignored in beta ==")
g, _, g_id = verified_member("gus")
h, _, h_id = verified_member("hal")
g.call("/introductions", {"target_user_id": h_id, "text": INTRO})
intro_gh = d(h.call("/introductions?direction=incoming"))["introductions"][0]
h.call(f"/introductions/{intro_gh['id']}", {"action": "accept"})
r = g.call("/households", {"introduction_id": intro_gh["id"], "plan": {"propertyId": "anything-at-all"}})
check("household proposal succeeds", r[0] == 200, r[1].get("error"))
check("no property is stored on the plan", sql(f'select count(*) from "HouseholdPlan" p join "Membership" m on m."householdId" = p."householdId" where m."userId" = {lit(g_id)} and p."propertyId" is not null') == "0")
check("and none is exposed", (d(g.call("/households/current")).get("household") or {}).get("currentPlan", {}).get("propertyId") is None)

print("== ENG-06: re-consent on a new privacy notice ==")
current = sql(f'select "privacyConsentVersion" from "User" where id = {lit(a_id)}')
sql(f'update "User" set "privacyConsentVersion" = \'privacy-v0\' where id = {lit(a_id)}')
c_a = C()
code = new_code(a_email)
r = c_a.call("/auth/verify-code", {"email": a_email, "code": code})
check("older consent version must re-consent", err(r) == "CONSENT_REQUIRED" and "updated" in r[1]["error"]["message"], r[1].get("error"))
r = c_a.call("/auth/verify-code", {"email": a_email, "code": code, "accept_privacy": True})
check("same code works after accepting", r[0] == 200, r[1].get("error"))
r = C().call("/auth/verify-code", {"email": a_email, "code": code, "accept_privacy": True})
check("a used code can't be replayed", r[0] == 422 and err(r) == "CODE_EXPIRED", f"{r[0]} {err(r)}")
check("consent version updated", sql(f'select "privacyConsentVersion" from "User" where id = {lit(a_id)}') == current)
check("consent audit written", sql(f'select count(*) from "AuditEvent" where "eventType" = \'auth.consent_recorded\' and "actorId" = {lit(a_id)} and "safeBefore" like \'%privacy-v0%\'') == "1")

print("== ENG-06: deletion-pending accounts can't sign back in ==")
# a has a pending intro to b and an open chat with nobody; give a a pending intro first.
check("pending intro before deletion", a.call("/introductions", {"target_user_id": b_id, "text": INTRO})[0] == 200)
check("deletion requested", c_a.call("/me/delete", {})[0] == 200)
check("deleted account's old session no longer works", c_a.call("/me")[0] == 401)
check("deletion ends pending intros", sql(f'select count(*) from "Introduction" where state = \'pending\' and ("lowUserId" = {lit(a_id)} or "highUserId" = {lit(a_id)})') == "0")
sessions_before = sql(f'select count(*) from "Session" where "userId" = {lit(a_id)}')
code = new_code(a_email)
r = C().call("/auth/verify-code", {"email": a_email, "code": code, "accept_privacy": True})
check("sign-in refused with 403", r[0] == 403 and err(r) == "FORBIDDEN", r[1].get("error"))
check("no session created", sql(f'select count(*) from "Session" where "userId" = {lit(a_id)}') == sessions_before == "0")
check("code not consumed", sql(f'select count(*) from "AuthCode" where email = {lit(a_email)}') == "1")
check("denial audited", sql(f'select count(*) from "AuditEvent" where "eventType" = \'auth.session_denied\' and "subjectId" = {lit(a_id)} and "reasonCode" = \'deletion_pending\' and outcome = \'denied\'') == "1")

# ------------------------------------------------------------------------------------------
# ENG-10: the launch journey — request access → staff invite → invite sign-up → onboarding →
# staff ID approval → discover → intro → chat → block/report → household agreement →
# feedback → survey opt-in → survey send → unsubscribe → export/delete.
# ------------------------------------------------------------------------------------------
admin_c, admin_email, admin_id = member("admin", "camden")
sql(f'update "User" set role = \'admin\' where id = {lit(admin_id)}')


def audits(event, extra=""):
    return int(sql(f'select count(*) from "AuditEvent" where "eventType" = {lit(event)} {extra}'))


def request_row(email, col="status"):
    return sql(f'select "{col}" from "AccessRequest" where email = {lit(email)} order by "createdAt" desc limit 1')


print("== D15: request access ==")
ada = f"beta-ada-req-{RUN}@example.com"
req = {"name": "Ada", "email": ada.upper(), "city": "lagos", "area": "yaba", "move_in_month": (today.replace(day=1) + datetime.timedelta(days=40)).strftime("%Y-%m"),
       "how_heard": "friend", "note": "Looking for a calm flatmate near work.", "consent": True}
ip_req = next_ip()
r = C().call("/access-requests", req, ip=ip_req)
check("request accepted: 202 received", r[0] == 202 and d(r) == {"status": "received"}, r)
check("stored once, email lower-cased, pending, with the privacy version", request_row(ada, "status") == "pending" and request_row(ada, "consentVersion") == "privacy-v2")
r2 = C().call("/access-requests", req, ip=next_ip())
check("a repeat gets the same 202 and stores nothing new", r2[0] == 202 and d(r2) == d(r) and sql(f'select count(*) from "AccessRequest" where email = {lit(ada)}') == "1")
r3 = C().call("/access-requests", {**req, "email": m_email}, ip=next_ip())
check("an existing member's address gets the same 202 and stores nothing", r3[0] == 202 and d(r3) == d(r) and sql(f'select count(*) from "AccessRequest" where email = {lit(m_email)}') == "0")
r = C().call("/access-requests", {**req, "city": "paris", "email": "nope"}, ip=next_ip())
check("bad input: 422 with field errors", r[0] == 422 and err(r) == "VALIDATION" and {"city", "email"} <= set(r[1]["error"]["field_errors"]), r)
r = C().call("/access-requests", {**req, "consent": False}, ip=next_ip())
check("no consent: 422 CONSENT_REQUIRED", r[0] == 422 and err(r) == "CONSENT_REQUIRED", r)
r = C().call("/access-requests", {**req, "area": "hackney"}, ip=next_ip())
check("area must belong to the city", r[0] == 422 and "area" in (r[1]["error"]["field_errors"] or {}))
lon = f"beta-lon-req-{RUN}@example.com"
r = C().call("/access-requests", {**req, "email": lon, "city": "london", "area": "not_sure", "move_in_month": "not_sure"}, ip=next_ip())
check("London is accepted too", r[0] == 202 and request_row(lon) == "pending")
for i in range(4):
    C().call("/access-requests", {**req, "email": f"beta-ipcap{i}-{RUN}@example.com"}, ip=ip_req)
r = C().call("/access-requests", {**req, "email": f"beta-ipcap9-{RUN}@example.com"}, ip=ip_req)
check("per-IP limit: the 6th request in an hour is 429", r[0] == 429 and err(r) == "RATE_LIMITED", r[0])
check("audit carries the city and nothing personal",
      audits("access.requested", "and \"occurredAt\" > now() - interval '5 minutes'") >= 3
      and sql(f'''select count(*) from "AuditEvent" where "eventType" = 'access.requested' and ("safeAfter" like {lit('%' + ada + '%')} or "safeAfter" like '%Ada%')''') == "0")

print("== D15: invite required for new accounts ==")
r = C().call("/auth/request-code", {"email": "a@b.co,d@e.fg"}, ip=next_ip())
check("two addresses in one field: 422 (HM-32)", r[0] == 422 and err(r) == "VALIDATION", r[0])
r = C().call("/auth/request-code", {"email": ada}, ip=next_ip())
check("new address, no invite: 403 INVITE_REQUIRED pointing to /request-access",
      r[0] == 403 and err(r) == "INVITE_REQUIRED" and "/request-access" in r[1]["error"]["message"], r)
r_unknown = C().call("/auth/request-code", {"email": f"beta-nobody-{RUN}@example.com"}, ip=next_ip())
check("…the same answer for any unknown address", r_unknown[0] == 403 and r_unknown[1]["error"] == r[1]["error"])
r = C().call("/auth/request-code", {"email": ada, "invite_code": "not-a-code"}, ip=next_ip())
check("junk invite code: 422 INVITE_INVALID", r[0] == 422 and err(r) == "INVITE_INVALID", r)
r = C().call("/auth/request-code", {"email": ada, "invite_code": "ABCD-EFGH"}, ip=next_ip())
check("well-formed unknown code: 422 INVITE_INVALID", r[0] == 422 and err(r) == "INVITE_INVALID")
_, expired_code = sql_invite(ada, "now() - interval '1 minute'")
r = C().call("/auth/request-code", {"email": ada, "invite_code": expired_code}, ip=next_ip())
check("expired invite: 422 INVITE_INVALID", err(r) == "INVITE_INVALID")
r = C().call("/auth/request-code", {"email": m_email, "invite_code": "ABCD-EFGH"}, ip=next_ip())
check("an existing account ignores invite_code entirely", r[0] != 422 and err(r) != "INVITE_INVALID", f"{r[0]} {err(r)}")
check("no code row was made for a refused address", sql(f'select count(*) from "AuthCode" where email = {lit(ada)}') == "0")

print("== D15: staff review and invite ==")
r = flood_c.call("/staff/access-requests")
check("members can't list access requests", r[0] == 403)
r = admin_c.call("/staff/access-requests?status=pending")
rows = {x["email"]: x for x in d(r).get("requests", [])}
check("staff see the pending request with what was typed", ada in rows and rows[ada]["name"] == "Ada" and rows[ada]["note"].startswith("Looking"))
check("London is marked waitlisted (OPEN_CITIES=lagos) and sorted last",
      rows.get(lon, {}).get("waitlisted") is True and rows[ada]["waitlisted"] is False
      and [x["email"] for x in d(r)["requests"]].index(lon) > [x["email"] for x in d(r)["requests"]].index(ada), rows.get(lon))
check("bad status filter: 422", admin_c.call("/staff/access-requests?status=nope")[0] == 422)
check("unknown request: 404", admin_c.call("/staff/access-requests/nope", {"action": "invite"})[0] == 404)
check("unknown action: 422", admin_c.call(f"/staff/access-requests/{rows[ada]['id']}", {"action": "approve"})[0] == 422)
r = admin_c.call(f"/staff/access-requests/{rows[ada]['id']}", {"action": "invite"})
inv_code, inv_url = d(r).get("invite_code"), d(r).get("invite_url", "")
check("invite: 200, link returned, email sent", r[0] == 200 and d(r).get("email_status") == "sent" and inv_url.endswith("/invite/" + str(inv_code)), r)
mail = wait_mail(ada, lambda m: "invite" in m.get("subject", "").lower())
check("the invite email has the link and the code", mail and inv_url in mail["html"] and inv_code in mail["text"])
check("request is now invited, reviewed by staff", request_row(ada) == "invited" and request_row(ada, "reviewedBy") == admin_id)
check("invite audited without the address", audits("access.invited", f'and "actorId" = {lit(admin_id)}') == 1
      and sql(f'''select count(*) from "AuditEvent" where "eventType" in ('access.invited', 'invite.emailed') and ("safeAfter" like {lit('%' + ada + '%')} or "safeBefore" like {lit('%' + ada + '%')})''') == "0")
r = admin_c.call(f"/staff/access-requests/{rows[ada]['id']}", {"action": "invite"})
check("inviting twice: 409 STATE_CONFLICT", r[0] == 409 and err(r) == "STATE_CONFLICT")

print("== D15: the invite link ==")
ipc = next_ip()
r = C().call(f"/invites/{inv_code}", ip=ipc)
check("valid invite: {valid: true, email_hint} with a masked address", d(r).get("valid") is True and d(r).get("email_hint", "").startswith("be•••@"), d(r))
check("lower case and hyphens work", d(C().call(f"/invites/{inv_code[:4].lower()}-{inv_code[4:].lower()}", ip=ipc)).get("valid") is True)
unknown, expired = C().call("/invites/ABCDEFGH", ip=ipc), C().call(f"/invites/{expired_code}", ip=ipc)
check("unknown and expired codes look the same", unknown[0] == expired[0] == 200 and d(unknown) == d(expired) == {"valid": False})
ipx = next_ip()
statuses = [C().call("/invites/ABCDEFGH", ip=ipx)[0] for _ in range(31)]
check("invite checks are rate-limited per IP (31st is 429)", statuses[:30] == [200] * 30 and statuses[30] == 429, statuses[-3:])
r = C().call("/auth/request-code", {"email": f"beta-thief-{RUN}@example.com", "invite_code": inv_code}, ip=next_ip())
check("a bound invite doesn't work for another address", r[0] == 422 and err(r) == "INVITE_INVALID")

print("== D15: invite sign-up ==")
ada_c = C()
r = ada_c.call("/auth/request-code", {"email": ada, "invite_code": inv_code}, ip=next_ip())
check("request-code with the invite: sent", r[0] == 200 and d(r).get("status") == "sent", r)
code = login_code(ada)
check("the code is emailed", bool(code))
check("the invite isn't used up yet", sql(f'select "usedAt" is null from "Invite" where "codeHash" = {lit(hashlib.sha256(inv_code.encode()).hexdigest())}') == "t")
r = ada_c.call("/auth/verify-code", {"email": ada, "code": code})
check("privacy consent is still required first (code kept)", err(r) == "CONSENT_REQUIRED")
r = ada_c.call("/auth/verify-code", {"email": ada, "code": code, "accept_privacy": True})
check("account created", r[0] == 200 and d(r).get("is_new") is True, r)
ada_id = user_id(ada)
check("invite consumed by this account", sql(f'select "usedByUserId" from "Invite" where "codeHash" = {lit(hashlib.sha256(inv_code.encode()).hexdigest())}') == ada_id)
check("invite use audited", audits("invite.used", f'and "actorId" = {lit(ada_id)}') == 1)
check("the link no longer works", d(C().call(f"/invites/{inv_code}", ip=next_ip())) == {"valid": False})
r = C().call("/auth/request-code", {"email": ada}, ip=next_ip())
check("signing in again needs no invite", r[0] == 200 and d(r).get("status") == "sent", r)

print("== D15: resend, decline and ad-hoc invites ==")
bo = f"beta-bo-req-{RUN}@example.com"
C().call("/access-requests", {**req, "name": "Bo", "email": bo}, ip=next_ip())
bo_id = d(admin_c.call("/staff/access-requests"))["requests"]
bo_id = next(x["id"] for x in bo_id if x["email"] == bo)
first = d(admin_c.call(f"/staff/access-requests/{bo_id}", {"action": "invite"}))["invite_code"]
r = admin_c.call(f"/staff/access-requests/{bo_id}", {"action": "resend"})
second = d(r).get("invite_code")
check("resend makes a new code and emails it", r[0] == 200 and second and second != first and d(r)["email_status"] == "sent")
check("the old code stops working, the new one works",
      d(C().call(f"/invites/{first}", ip=next_ip()))["valid"] is False and d(C().call(f"/invites/{second}", ip=next_ip()))["valid"] is True)
check("resend audited", audits("access.invite_resent", f'and "resourceId" = {lit(bo_id)}') == 1)
r = admin_c.call(f"/staff/access-requests/{bo_id}", {"action": "decline", "reason": "Test decline"})
check("declining an invited request works and kills the invite",
      r[0] == 200 and request_row(bo) == "declined" and d(C().call(f"/invites/{second}", ip=next_ip()))["valid"] is False)
check("…and stores the reason", request_row(bo, "declineReason") == "Test decline")
r = admin_c.call("/staff/invites", {})
open_code = d(r).get("invite_code")
check("ad-hoc invite without an email: unbound, not emailed", r[0] == 200 and d(r).get("bound") is False and d(r).get("email_status") == "not_requested")
hours = (datetime.datetime.fromisoformat(d(r)["expires_at"].replace("Z", "+00:00")) - datetime.datetime.now(datetime.timezone.utc)).total_seconds() / 3600
check("unbound codes expire after 72 hours (HM-29)", 71.5 < hours <= 72.1, f"{hours:.2f} h")
x1, x2 = f"beta-race1-{RUN}@example.com", f"beta-race2-{RUN}@example.com"
c1, c2 = C(), C()
r1 = c1.call("/auth/request-code", {"email": x1, "invite_code": open_code}, ip=next_ip())
r2 = c2.call("/auth/request-code", {"email": x2, "invite_code": open_code}, ip=next_ip())
check("an unbound invite lets either address ask for a code", r1[0] == r2[0] == 200)
k1, k2 = login_code(x1), login_code(x2)
r1 = c1.call("/auth/verify-code", {"email": x1, "code": k1, "accept_privacy": True})
r2 = c2.call("/auth/verify-code", {"email": x2, "code": k2, "accept_privacy": True})
check("only the first sign-up uses it; the second gets INVITE_INVALID",
      r1[0] == 200 and r2[0] == 422 and err(r2) == "INVITE_INVALID" and user_id(x2) == "", f"{r1[0]} / {r2[0]} {err(r2)}")
check("…and the second person's code isn't burnt", sql(f'select count(*) from "AuthCode" where email = {lit(x2)}') == "1")
r = admin_c.call("/staff/invites", {"email": ada})
check("ad-hoc invite for an existing account: 409", r[0] == 409 and err(r) == "STATE_CONFLICT")
check("ad-hoc invite with a bad email: 422", admin_c.call("/staff/invites", {"email": "nope"})[0] == 422)
check("members can't create invites: 404", flood_c.call("/staff/invites", {})[0] == 404)
check("non-admin staff can't create ad-hoc invites either (HM-31): 404", staff_c.call("/staff/invites", {})[0] == 404 and staff_c.call("/staff/invites")[0] == 404)

print("== HM-29: revoke, and site-wide caps on invite guessing ==")
rv = f"beta-rv-req-{RUN}@example.com"
C().call("/access-requests", {**req, "name": "Rev", "email": rv}, ip=next_ip())
rv_id = next(x["id"] for x in d(admin_c.call("/staff/access-requests"))["requests"] if x["email"] == rv)
rv_code = d(admin_c.call(f"/staff/access-requests/{rv_id}", {"action": "invite"}))["invite_code"]
rv_inv = next(x for x in d(admin_c.call("/staff/access-requests?status=invited"))["requests"] if x["email"] == rv)["invite"]
check("the staff list exposes the invite id and state", rv_inv["state"] == "active" and rv_inv["id"])
check("members can't revoke: 403", flood_c.call(f"/staff/invites/{rv_inv['id']}", {"action": "revoke"})[0] == 403)
r = staff_c.call(f"/staff/invites/{rv_inv['id']}", {"action": "revoke"})
check("any staff role can revoke", r[0] == 200 and d(r).get("state") == "revoked", r)
check("a revoked code answers {valid:false}", d(C().call(f"/invites/{rv_code}", ip=next_ip())) == {"valid": False})
r = C().call("/auth/request-code", {"email": rv, "invite_code": rv_code}, ip=next_ip())
check("…and can't start a sign-up", err(r) == "INVITE_INVALID")
check("revoking twice: 409", staff_c.call(f"/staff/invites/{rv_inv['id']}", {"action": "revoke"})[0] == 409)
check("revoke audited", audits("invite.revoked", f'and "resourceId" = {lit(rv_inv["id"])}') == 1)
check("unknown invite: 404", staff_c.call("/staff/invites/nope", {"action": "revoke"})[0] == 404)
adhoc_id = d(admin_c.call("/staff/invites", {}))["id"]
check("admins see direct invites to revoke", any(i["id"] == adhoc_id and i["state"] == "active" for i in d(admin_c.call("/staff/invites"))["invites"]))
cap = f"e2e-cap-{RUN}"
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       select {lit(cap)} || g, 'invite.checked', 'service', 'ip', {lit(cap)} || g, 'check', 'allowed', now() from generate_series(1, 300) g''')
r = C().call(f"/invites/{rv_code}", ip=next_ip())
check("300 invite checks site-wide in an hour: the next is 429, from any IP", r[0] == 429 and err(r) == "RATE_LIMITED", r[0])
abuse = d(admin_c.call("/staff/access-requests")).get("abuse", {})
check("staff see the invite-check count", abuse.get("invite_checks_1h", 0) >= 300 and abuse.get("max_checks_1h") == 300, abuse)
sql(f'delete from "AuditEvent" where "resourceId" like {lit(cap + "%")}')
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       select {lit(cap)} || g, 'auth.code_requested', 'service', 'ip', {lit(cap)} || g, 'invite_invalid', 'denied', now() from generate_series(1, 300) g''')
_, good_code = sql_invite(f"beta-capped-{RUN}@example.com")
r = C().call("/auth/request-code", {"email": f"beta-capped-{RUN}@example.com", "invite_code": good_code}, ip=next_ip())
check("300 wrong invite codes site-wide: every invite sign-up waits, even with a good code", r[0] == 429 and err(r) == "RATE_LIMITED", r)
check("staff see the wrong-code count", d(admin_c.call("/staff/access-requests"))["abuse"]["invite_failures_1h"] >= 300)
sql(f'delete from "AuditEvent" where "resourceId" like {lit(cap + "%")}')

print("== Onboarding → staff ID approval → discover ==")
ada_c.call("/me/profile", {"journey": "find_together", "displayName": "Ada", "bio": "Invited beta member with a bio that is comfortably longer than eighty characters."}, method="PATCH")
lagos_dates = {"moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(), "latestDate": (today + datetime.timedelta(days=50)).isoformat(),
               "stayMinMonths": 6, "stayMaxMonths": 12}
ada_c.call("/me/search", {"cityId": "lagos", "areaIds": ["yaba"], "rentPeriod": "year", "rentMinMinor": 150000000, "rentMaxMinor": 250000000, **lagos_dates}, method="PATCH")
habits = {"cleaning": "weekly", "quiet": "before_00", "guests": "up_to_2_nights", "smoking": "no", "pets": "none", "social": "balanced"}
ada_c.call("/me/search", {"gender": "prefer_not_to_say", "preferences": [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in habits.items()]}, method="PATCH")
r = ada_c.call("/me/search/publish", {})
check("invited member publishes", r[0] == 200, r[1].get("error"))
check("…and waits in the ID queue", ada_id in [c["userId"] for c in d(admin_c.call("/staff/verifications")).get("cases", [])])
r = admin_c.call(f"/staff/verifications/{ada_id}", {"action": "approve"})
check("staff approve the ID check", r[0] == 200, r[1].get("error"))
tobi_c, tobi_email, tobi_id = member("tobi", "yaba", "lagos")
kemi_c, kemi_email, kemi_id = member("kemi", "yaba", "lagos")
for uid in (tobi_id, kemi_id):
    admin_c.call(f"/staff/verifications/{uid}", {"action": "approve"})
cands = [c["userId"] for c in d(ada_c.call("/recommendations")).get("candidates", [])]
check("verified Lagos members discover each other", tobi_id in cands and kemi_id in cands, cands)

print("== Intro → chat → block/report → household agreement ==")
r = ada_c.call("/introductions", {"target_user_id": tobi_id, "text": INTRO})
check("intro sent", r[0] == 200, r[1].get("error"))
intro = d(tobi_c.call("/introductions?direction=incoming"))["introductions"][0]
r = tobi_c.call(f"/introductions/{intro['id']}", {"action": "accept"})
convo = d(r).get("conversationId")
check("intro accepted, chat opens", r[0] == 200 and convo)
r = ada_c.call(f"/conversations/{convo}/messages", {"client_message_id": "j1", "body": "Hi Tobi, when could you move?"})
check("message sent", r[0] == 200, r[1].get("error"))
msgs = d(tobi_c.call(f"/conversations/{convo}/messages")).get("messages", [])
check("the other person reads it", any("when could you move" in m.get("body", "") for m in msgs))
r = ada_c.call("/reports", {"target_user_id": kemi_id, "category": "other", "description": "End-to-end test report, please ignore this one."})
check("report filed", r[0] == 200, r[1].get("error"))
check("block works", ada_c.call("/blocks", {"target_user_id": kemi_id})[0] == 200)
check("blocked person disappears from discover", kemi_id not in [c["userId"] for c in d(ada_c.call("/recommendations")).get("candidates", [])])
r = ada_c.call("/households", {"introduction_id": intro["id"], "plan": {}})
check("household proposed", r[0] == 200, r[1].get("error"))
hh = d(tobi_c.call("/households/current"))["household"]
r = tobi_c.call(f"/households/{hh['id']}", {"action": "accept", "expected_version": hh.get("version")})
check("the other person accepts the agreement", r[0] == 200, r[1].get("error"))
check("household is active", d(ada_c.call("/households/current"))["household"]["state"] == "active")

print("== ENG-31: feedback ==")
r = ada_c.call("/feedback", {"message": "The ID call booking was smooth.", "rating": 4, "page": "/discover"})
check("signed-in feedback received", r[0] == 200)
fb = d(admin_c.call("/staff/research")).get("feedback", [])
mine = next((f for f in fb if f["message"] == "The ID call booking was smooth."), None)
check("staff see only the 6-character ref, not the account ID", mine and ada_id not in json.dumps(fb) and "userId" not in mine["sender"])
check("staff see who sent it (name + ref, no email)", mine and mine["sender"]["displayName"] == "Ada" and mine["sender"]["ref"] == ada_id[-6:].upper()
      and ada not in json.dumps(fb))
check("beta staff counts are members/verified/feedback, no persona or demo counts",
      set(d(admin_c.call("/staff/research"))["counts"]) == {"members", "verified", "feedback7d"})
fip = next_ip()
outs = [C().call("/feedback", {"message": f"Signed-out note {i}", "page": "/"}, ip=fip)[0] for i in range(6)]
check("signed-out feedback: 5 per 10 minutes per IP, the 6th is 429", outs == [200] * 5 + [429], outs)
anon = next((f for f in d(admin_c.call("/staff/research"))["feedback"] if f["message"] == "Signed-out note 0"), None)
check("signed-out feedback shows as signed out", anon and anon["sender"] == {"signedIn": False})

print("== ENG-29: survey opt-in ==")
r = ada_c.call("/me/preferences")
check("default: opted out", r[0] == 200 and d(r)["survey_opt_in"] is False)
check("only a boolean is accepted", ada_c.call("/me/preferences", {"survey_opt_in": "yes"}, method="PATCH")[0] == 422)
r = ada_c.call("/me/preferences", {"survey_opt_in": True, "source": "onboarding"}, method="PATCH")
check("opt in from onboarding", r[0] == 200 and d(r)["survey_opt_in"] is True and d(r)["survey_opt_in_version"] == "survey-v1" and d(r)["survey_opt_in_at"])
check("consent audited with version and source",
      audits("consent.survey_granted", f'''and "actorId" = {lit(ada_id)} and "safeAfter" like '%survey-v1%' and "safeAfter" like '%onboarding%' ''') == 1)
ada_c.call("/me/preferences", {"survey_opt_in": True}, method="PATCH")
check("opting in again writes no second audit row", audits("consent.survey_granted", f'and "actorId" = {lit(ada_id)}') == 1)
check("signed out: 401", C().call("/me/preferences")[0] == 401)

print("== D17: survey send ==")
SURVEY = {"campaign": f"e2e-{RUN[-6:]}", "survey_url": "https://tally.so/r/e2e-test", "limit": 50}
check("members get 404", ada_c.call("/staff/survey/send", {**SURVEY, "dry_run": True})[0] == 404)
check("non-admin staff get 404", staff_c.call("/staff/survey/send", {**SURVEY, "dry_run": True})[0] == 404)
check("bad campaign / URL: 422", admin_c.call("/staff/survey/send", {**SURVEY, "campaign": "X"})[0] == 422
      and admin_c.call("/staff/survey/send", {**SURVEY, "survey_url": "http://x.com"})[0] == 422)
dry = d(admin_c.call("/staff/survey/send", {**SURVEY, "dry_run": True}))
check("dry run counts and sends nothing", dry.get("dry_run") is True and dry["would_send"] >= 1 and not wait_mail(ada, lambda m: "survey" in m.get("subject", "").lower(), 1), dry)
r = admin_c.call("/staff/survey/send", SURVEY)
check("send: 200, nothing failed", r[0] == 200 and d(r)["failed"] == 0 and d(r)["sent"] >= 1 and d(r)["remaining"] == 0, d(r))
sm = wait_mail(ada, lambda m: "survey" in m.get("subject", "").lower())
ref = re.search(r"https://tally\.so/r/e2e-test\?ref=([0-9a-f]+)", sm["text"] if sm else "")
check("the survey email arrives with a pseudonymous ref (not the account ID)", ref and ada_id not in ref.group(0))
lu = (sm or {}).get("headers", {})
check("List-Unsubscribe (+ one-click) headers set", lu.get("List-Unsubscribe", "").startswith("<http") and lu.get("List-Unsubscribe-Post") == "List-Unsubscribe=One-Click", lu)
check("not sent to members who didn't opt in", not [m for m in mails_to(tobi_email) if "survey" in m.get("subject", "").lower()])
check("each send audited, without the address",
      audits("survey.sent", f'and "subjectId" = {lit(ada_id)} and "resourceId" = {lit(SURVEY["campaign"])}') == 1
      and sql(f'''select count(*) from "AuditEvent" where "eventType" = 'survey.sent' and coalesce("safeAfter", '') like {lit('%' + ada + '%')}''') == "0")
r = admin_c.call("/staff/survey/send", SURVEY)
check("a second press sends nobody twice", d(r).get("sent") == 0 and len([m for m in mails_to(ada) if "survey" in m.get("subject", "").lower()]) == 1, d(r))

print("== ENG-30: survey export ==")
st, hdrs, csv = admin_c.raw("/api/v1/staff/survey/export.csv")
check("admin gets a CSV attachment, no-store", st == 200 and "text/csv" in hdrs.get("content-type", "") and "attachment" in hdrs.get("content-disposition", "") and hdrs.get("cache-control") == "no-store", hdrs)
check("it lists opted-in members only", ada in csv and tobi_email not in csv and csv.startswith("email,first_name,city"))
check("export audited with the row count only", audits("staff.export_survey_optins", f'and "actorId" = {lit(admin_id)}') == 1)
check("non-admin staff get 404", staff_c.raw("/api/v1/staff/survey/export.csv")[0] == 404)

print("== ENG-29: unsubscribe link ==")
unsub = re.search(r"<([^>]+)>", lu.get("List-Unsubscribe", "<>")).group(1)
token = urllib.parse.parse_qs(urllib.parse.urlparse(unsub).query).get("token", [""])[0]
page_link = re.search(r"https?://[^\s\"<]+/unsubscribe\?token=[^\s\"<]+", sm["text"] if sm else "")
check("the email links to the /unsubscribe page with the same token", page_link and urllib.parse.unquote(page_link.group(0).split("token=")[1]) == token)
q = "/unsubscribe?token=" + urllib.parse.quote(token)
r = C().call(q)
check("GET shows the state and changes nothing", d(r) == {"status": "subscribed"} and sql(f'select "surveyOptIn" from "User" where id = {lit(ada_id)}') == "t")
r = C().call(q, {})
check("POST unsubscribes, signed out", d(r) == {"status": "unsubscribed"} and sql(f'select "surveyOptIn" from "User" where id = {lit(ada_id)}') == "f")
check("…audited via the link", audits("consent.survey_withdrawn", f'''and "actorId" = {lit(ada_id)} and "safeAfter" like '%unsubscribe_link%' ''') == 1)
r = C().call(q, {})
check("a second POST is 200 with no new audit row", r[0] == 200 and audits("consent.survey_withdrawn", f'and "actorId" = {lit(ada_id)}') == 1)
bad = C().call("/unsubscribe?token=" + urllib.parse.quote(token[:-3] + "abc"), {})
check("tampered token: 404, no account hint", bad[0] == 404 and err(bad) == "NOT_FOUND" and ada not in json.dumps(bad[1]))
dry = d(admin_c.call("/staff/survey/send", {**SURVEY, "campaign": SURVEY["campaign"] + "-r", "dry_run": True}))
check("unsubscribed people aren't eligible any more", ada not in admin_c.raw("/api/v1/staff/survey/export.csv")[2])
check("Settings shows the change", d(ada_c.call("/me/preferences"))["survey_opt_in"] is False and d(ada_c.call("/me/preferences"))["unsubscribed_at"])

print("== HM-30: purge old access requests ==")
old = f"beta-old-req-{RUN}@example.com"
C().call("/access-requests", {**req, "email": old}, ip=next_ip())
sql(f'''update "AccessRequest" set "createdAt" = now() - interval '31 days' where email = {lit(old)}''')
fresh = f"beta-fresh-req-{RUN}@example.com"
C().call("/access-requests", {**req, "email": fresh}, ip=next_ip())
check("purge is admin only: 404 for other staff", staff_c.call("/staff/access-requests/purge", {"dry_run": True})[0] == 404)
dry = d(admin_c.call("/staff/access-requests/purge", {"dry_run": True}))
check("dry run counts declined and stale pending, deletes nothing",
      dry.get("declined", 0) >= 1 and dry.get("stale_pending", 0) >= 1 and request_row(bo) == "declined")
r = admin_c.call("/staff/access-requests/purge", {})
check("purge deletes declined and >30-day pending requests", r[0] == 200 and request_row(bo) == "" and request_row(old) == "", d(r))
check("…but keeps recent pending and invited ones", request_row(fresh) == "pending" and request_row(rv) == "invited")
check("purge audited with counts only", sql(f'''select count(*) from "AuditEvent" where "eventType" = 'access.purged' and "actorId" = {lit(admin_id)} and "safeAfter" not like '%@%' ''') == "1")

print("== ENG-25: draft legal pages ==")
for path, needle in (("/privacy", "privacy-v2"), ("/terms", "Terms of use")):
    st, _, html = C().raw(path)
    check(f"{path}: draft banner, placeholders visible, no internal notes",
          st == 200 and "Draft — under review" in html and needle in html and "[CONTROLLER NAME]" in html
          and "Draft written by AI" not in html and "Note: counsel" not in html, st)

print("== Export and delete ==")
ex = d(ada_c.call("/me/export")).get("export", {})
check("export includes feedback and survey choices",
      any(f["message"] == "The ID call booking was smooth." for f in ex.get("feedback", []))
      and ex.get("account", {}).get("surveyOptIn") is False and ex["account"].get("surveyOptInVersion") == "survey-v1" and ex["account"].get("unsubscribedAt"))
check("export includes the access request, invite and survey sends (HM-30)",
      any(x["email"] == ada for x in ex.get("accessRequests", [])) and ex.get("invites") and any(x["campaign"] == SURVEY["campaign"] for x in ex.get("surveyEmails", [])))
check("deletion requested", ada_c.call("/me/delete", {})[0] == 200)
check("deletion removes the access request and the address on invites (HM-30)",
      sql(f'select count(*) from "AccessRequest" where email = {lit(ada)}') == "0" and sql(f'select count(*) from "Invite" where email = {lit(ada)}') == "0"
      and sql(f'select count(*) from "Invite" where "usedByUserId" = {lit(ada_id)}') == "1")
check("feedback deleted with the account", sql(f'select count(*) from "TesterFeedback" where "userId" = {lit(ada_id)}') == "0")
r = C().call("/auth/request-code", {"email": ada}, ip=next_ip())
check("a deleting account is still an account: no invite asked", err(r) != "INVITE_REQUIRED", f"{r[0]} {err(r)}")

print()
print(f"{fails} FAILED" if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
