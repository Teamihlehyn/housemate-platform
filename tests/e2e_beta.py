"""End-to-end checks for beta mode: approval-first sign-up (ENG-39–44, spec §6 cases 1–16),
the staff allowlist (HM-10), gating, safety, the member journey, feedback, survey
opt-in/send/unsubscribe, export and deletion.

Usage:
  python3 tests/e2e_beta.py http://localhost:3100 "postgresql://<you>@localhost:5432/<beta_test_db>"
  E2E_PAUSED=1 python3 tests/e2e_beta.py …   # case 16 only, against a server with SIGNUPS_PAUSED=true

Needs a LOCAL beta-mode server and a psql connection string for the same database. The
script runs a fake Resend on 127.0.0.1:$MAIL_PORT (default 8025) and reads the emails the
app sends, so start the server with:
  APP_ENV=beta NEXT_PUBLIC_APP_ENV=beta OPEN_CITIES=lagos \
  RESEND_API_KEY=test-key EMAIL_FROM="Peabudy <test@example.com>" EMAIL_API_URL=http://127.0.0.1:8025 \
  ADMIN_EMAILS=e2e-admin@example.com \
  STAFF_EMAILS=e2e-verifier@example.com:verifier,e2e-moderator@example.com:moderator,e2e-lock@example.com:moderator \
  DATABASE_URL=… DIRECT_URL=… next dev -p 3100
(EMAIL_API_URL is honoured only outside Vercel.) Some setup goes straight to the database:
pre-made members, codes for them, roles. Never point this at a shared or cloud database.
"""
import datetime, hashlib, hmac, http.cookiejar, http.server, json, os, random, re, statistics, subprocess, sys, threading, time
import urllib.error, urllib.parse, urllib.request, uuid
from concurrent.futures import ThreadPoolExecutor

BASE, PSQL = sys.argv[1], sys.argv[2]
if "neon.tech" in PSQL or "localhost" not in PSQL:
    sys.exit("Refusing to run: e2e_beta.py writes directly to the database; use a local one.")
fails = 0
RUN = datetime.datetime.now().strftime("%H%M%S%f")
today = datetime.date.today()
ADMIN_EMAIL, VERIFIER_EMAIL, MODERATOR_EMAIL = "e2e-admin@example.com", "e2e-verifier@example.com", "e2e-moderator@example.com"


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


def wait_mail(addr, pred=lambda m: True, timeout=10, after=0):
    end = time.time() + timeout
    while time.time() < end:
        found = [m for m in mails_to(addr)[after:] if pred(m)]
        if found:
            return found[-1]
        time.sleep(0.1)
    return None


def login_code(addr, after=0):
    """The six-digit code from the newest E0 ("Your Peabudy code: 123456")."""
    m = wait_mail(addr, lambda m: "Peabudy code" in m.get("subject", ""), after=after)
    return re.search(r"(\d{6})", m["subject"]).group(1) if m else None


_ip = iter(range(1, 60000))
NET = random.randint(1, 250)


def next_ip():  # a fresh client IP per call keeps the per-IP limits out of the way
    i = next(_ip)
    return f"10.{NET}.{i // 250}.{i % 250 + 1}"


class C:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.headers = {}
        self.cookie = None  # a raw "hm_session=…" sent instead of the jar's cookie

    def call(self, path, body=None, method=None, ip=None):
        # Local dev only: next dev trusts x-forwarded-for, so tests pick the client IP. A fresh
        # one by default; pass ip= to share a bucket on purpose.
        headers = {"Content-Type": "application/json", "X-Forwarded-For": ip or next_ip()}
        if self.cookie:
            headers["Cookie"] = self.cookie
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


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def first_hop(c, path):
    """(status, Location) of a page request without following redirects."""
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(c.jar), _NoRedirect())
    req = urllib.request.Request(BASE + path)
    if c.cookie:  # a raw session cookie set on the client (see C.cookie)
        req.add_header("Cookie", c.cookie)
    try:
        with op.open(req, timeout=60) as r:
            return r.status, r.headers.get("Location")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Location")


def email_key(email):
    """lib/auth.ts hashEmailKey with the local-only EMAIL_HASH_SECRET fallback."""
    return hmac.new(b"peabudy-email-hash-local-only-not-a-secret", ("email:" + email.strip().lower()).encode(), hashlib.sha256).hexdigest()[:32]


def reset_email_bucket(email):
    """Forget this run's per-address code requests (5 an hour), so later steps can ask again."""
    key = email_key(email)
    sql(f'delete from "AuditEvent" where "eventType" = \'auth.code_email\' and "resourceId" = {lit(key)}')


def check(name, cond, extra=""):
    global fails
    print(("  PASS " if cond else "  FAIL ") + name + (f"  ({extra})" if extra else ""))
    if not cond:
        fails += 1


def sql(q):
    return subprocess.check_output(["psql", PSQL, "-tAc", q], text=True).strip()


def lit(s):
    return "'" + s.replace("'", "''") + "'"


def new_code(email):
    code = "246810"
    sql(f'''insert into "AuthCode"(id, email, code, "expiresAt") values ({lit(uuid.uuid4().hex)}, {lit(email)}, {lit(code)}, now() + interval '10 minutes')''')
    return code


def user_id(email):
    return sql(f'select id from "User" where email = {lit(email)}')


def set_identity(uid, status):
    sql(f'update "VerificationCheck" set status = {lit(status)} where "userId" = {lit(uid)} and category = \'identity\'')


def audits(event, extra=""):
    return int(sql(f'select count(*) from "AuditEvent" where "eventType" = {lit(event)} {extra}'))


d = lambda r: r[1].get("data") or {}
err = lambda r: (r[1].get("error") or {}).get("code")


def sql_account(email, status="active", role="member", name="Member"):
    """An account made straight in the database (approval-first has no open sign-up)."""
    uid = "e2e" + uuid.uuid4().hex[:22]
    sql(f'''insert into "User"(id, email, "emailVerified", "displayName", "accountStatus", role, "updatedAt")
           values ({lit(uid)}, {lit(email)}, true, {lit(name)}, {lit(status)}, {lit(role)}, now())''')
    sql(f'''insert into "Profile"(id, "userId", "updatedAt") values ({lit("p" + uid)}, {lit(uid)}, now())''')
    sql(f'''insert into "Search"(id, "userId", "updatedAt") values ({lit("s" + uid)}, {lit(uid)}, now())''')
    return uid


def sign_in(email):
    c = C()
    r = c.call("/auth/verify-code", {"email": email, "code": new_code(email), "accept_privacy": True})
    assert r[0] == 200, (email, r)
    return c


INTRO = "Hello, our dates and areas line up well. Shall we talk about a place?"
HABITS = {"cleaning": "weekly", "quiet": "before_00", "guests": "up_to_2_nights", "smoking": "no", "pets": "none", "social": "balanced"}
PREFS = [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in HABITS.items()]
BIO = "Beta end-to-end test member with a bio comfortably over the eighty character minimum."
DATES = {"moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(),
         "latestDate": (today + datetime.timedelta(days=50)).isoformat(), "stayMinMonths": 6, "stayMaxMonths": 12}
LAGOS_MONEY = {"rentPeriod": "year", "rentMinMinor": 150000000, "rentMaxMinor": 250000000}


def member(name, area, city="london"):
    """A pre-made active member who publishes the older way (identity then waits in review)."""
    email = f"beta-{name}-{RUN}@example.com"
    sql_account(email, name=name.title())
    c = sign_in(email)
    c.call("/me/profile", {"journey": "find_together", "displayName": name.title(), "bio": BIO}, method="PATCH")
    money = {"rentPeriod": "month", "rentMinMinor": 80000, "rentMaxMinor": 120000} if city == "london" else LAGOS_MONEY
    c.call("/me/search", {"cityId": city, "areaIds": [area], **money, **DATES}, method="PATCH")
    c.call("/me/search", {"gender": "prefer_not_to_say", "preferences": PREFS}, method="PATCH")
    r = c.call("/me/search/publish", {})
    assert r[0] == 200, r
    return c, email, user_id(email)


STAFF_PASSWORD = "green kettle on a lagos tuesday " + RUN


def staff_setup_link(email, after=0):
    m = wait_mail(email, lambda m: "back-office password" in m.get("subject", ""), after=after)
    t = re.search(r"/staff/setup\?token=([A-Za-z0-9_-]+)", (m or {}).get("text", ""))
    return t.group(1) if t else None


def staff_code(email, after=0):
    m = wait_mail(email, lambda m: "back-office sign-in code" in m.get("subject", ""), after=after)
    return re.search(r"code is (\d{6})", m["text"]).group(1) if m else None


def staff_client(email, password=STAFF_PASSWORD):
    """The only way into the back office (ENG-47): set-up link → password → emailed code."""
    # Test set-up only: forget earlier runs' set-up requests and wrong passwords for this address
    # (3 links an hour, 5 wrong passwords in 15 minutes), so the suite can be re-run at once.
    sql(f'''delete from "AuditEvent" where "eventType" in ('staff.setup_requested', 'staff.pw_attempt_addr') and "resourceId" = {lit(email_key(email))}''')
    before = len(mails_to(email))
    C().call("/staff/auth/setup-request", {"email": email})
    token = staff_setup_link(email, after=before)
    assert token, f"no set-up link for {email}"
    r = C().call("/staff/auth/setup", {"token": token, "password": password})
    assert r[0] == 200, r
    c = C()
    before = len(mails_to(email))
    r = c.call("/staff/auth/password", {"email": email, "password": password})
    assert r[0] == 200, r
    r = c.call("/staff/auth/verify", {"email": email, "code": staff_code(email, after=before)})
    assert r[0] == 200 and d(r).get("redirect") == "/staff", r
    return c


def start_application(email):
    """/join steps 1–2 with the emailed code. Returns (client, verify response)."""
    c = C()
    before = len(mails_to(email))
    r = c.call("/applications/start", {"email": email, "consent_privacy": True})
    assert r[0] == 200, (email, r)
    code = login_code(email, after=before)
    assert code, f"no code mailed to {email}"
    return c, c.call("/applications/verify", {"email": email, "code": code})


def fill_application(c, name, city="lagos", area="yaba", gender="woman"):
    c.call("/me/profile", {"journey": "find_together", "displayName": name, "bio": BIO}, method="PATCH")
    money = LAGOS_MONEY if city == "lagos" else {"rentPeriod": "month", "rentMinMinor": 80000, "rentMaxMinor": 120000}
    c.call("/me/search", {"cityId": city, "areaIds": [area], **money, **DATES}, method="PATCH")
    return c.call("/me/search", {"gender": gender, "preferences": PREFS}, method="PATCH")


def application_id(email):
    return sql(f'select a.id from "Application" a join "User" u on u.id = a."userId" where u.email = {lit(email)}')


def app_version(aid):
    return int(sql(f'select version from "Application" where id = {lit(aid)}'))


def staff_act(c, aid, action, **extra):
    return c.call(f"/staff/applications/{aid}", {"action": action, "expected_version": app_version(aid), **extra})


def activate(email, admin, own_note=None):
    """Approve an applicant's submitted application, then activate it. Returns the member client."""
    aid = application_id(email)
    before = len(mails_to(email))
    extra = {"own_account": True, "relationship_note": own_note} if own_note else {}
    assert staff_act(admin, aid, "start_review")[0] == 200
    r = staff_act(admin, aid, "approve", id_check_confirmed=True, id_check_method="video", **extra)
    assert r[0] == 200, r
    code = d(r)["activation_code"]
    c = C()
    c.call(f"/invites/{code}", {})
    otp = login_code(email, after=before)
    r = c.call("/auth/verify-code", {"activation_code": code, "code": otp})
    assert r[0] == 200, r
    return c


def apply_activated(name, admin, area="yaba", gender="man", own_note=None):
    email = f"beta-{name}-{RUN}@example.com"
    c, _ = start_application(email)
    fill_application(c, name.title(), area=area, gender=gender)
    assert c.call("/applications/submit", {})[0] == 200
    return activate(email, admin, own_note), email, user_id(email)


if os.environ.get("E2E_PAUSED"):
    print("== Case 16: SIGNUPS_PAUSED ==")
    r = C().call("/applications/start", {"email": f"beta-paused-{RUN}@example.com", "consent_privacy": True})
    check("/join step 1 refuses with the pause message", r[0] == 403 and err(r) == "FORBIDDEN" and "not taking new applications" in r[1]["error"]["message"], r)
    pm = f"beta-pausedmember-{RUN}@example.com"
    sql_account(pm)
    r = C().call("/auth/request-code", {"email": pm})
    code = login_code(pm)
    check("existing members still get a sign-in code", r[0] == 200 and bool(code), r)
    r = C().call("/auth/verify-code", {"email": pm, "code": code, "accept_privacy": True})
    check("…and sign in normally", r[0] == 200, r)
    print()
    print(f"{fails} FAILED" if fails else "ALL PASSED")
    sys.exit(1 if fails else 0)


print("== Beta mode is on ==")
probe = f"beta-probe-{RUN}@example.com"
sql_account(probe)
r = C().call("/auth/request-code", {"email": probe})
check("no on-screen code in beta; the code is emailed", r[0] == 200 and not d(r).get("sink_code") and login_code(probe), f"{r[0]} {err(r)}")
if r[0] == 200 and not mails_to(probe):
    sys.exit(f"The server isn't sending mail to the fake Resend on :{MAIL_PORT}. Start it with EMAIL_API_URL=http://127.0.0.1:{MAIL_PORT}, RESEND_API_KEY and EMAIL_FROM.")
check("demo personas are off", C().call("/auth/demo-persona", {"persona": "ben", "accept_privacy": True})[0] == 404)

print("== HM-10: staff access only from the allowlist ==")
admin_c = staff_client(ADMIN_EMAIL)
admin_id = user_id(ADMIN_EMAIL)
check("an ADMIN_EMAILS address signs in as admin", d(admin_c.call("/staff/me")).get("role") == "admin" and sql(f'select role from "User" where id = {lit(admin_id)}') == "admin")
staff_c = staff_client(VERIFIER_EMAIL)
staff_email, staff_id = VERIFIER_EMAIL, user_id(VERIFIER_EMAIL)
check("a STAFF_EMAILS verifier signs in as verifier", d(staff_c.call("/staff/me")).get("role") == "verifier")
mod_c = staff_client(MODERATOR_EMAIL)
check("a STAFF_EMAILS moderator signs in as moderator", d(mod_c.call("/staff/me")).get("role") == "moderator")
rogue = f"beta-rogue-{RUN}@example.com"
rogue_id = sql_account(rogue, role="admin", name="Rogue")
token = uuid.uuid4().hex + uuid.uuid4().hex
sql(f'''insert into "Session"(token, "userId", "expiresAt") values ({lit(token)}, {lit(rogue_id)}, now() + interval '1 day')''')
rc = C()
rc.cookie = f"hm_session={token}"
codes_ = [rc.call(p)[0] for p in ("/staff/applications", "/staff/audit", "/staff/research", "/staff/verifications")]
check("a stored admin NOT on the allowlist gets 404 on /staff routes (an existing session)", codes_ == [404] * 4, codes_)
st, loc = first_hop(rc, "/staff")
check("…and the /staff page sends them to the back-office sign-in", st in (303, 307, 308) and (loc or "").endswith("/staff/signin"), f"{st} {loc}")
_st, _loc = first_hop(C(), "/staff")
check("a signed-out visitor to /staff is sent to /signin", _st in (303, 307, 308) and (_loc or "").endswith("/signin"), f"{_st} {_loc}")
check("…and is a member as far as /me says", d(rc.call("/me")).get("role") == "member")
check("…including admin-only tools (404)", rc.call("/staff/survey/send", {"campaign": "x", "dry_run": True})[0] == 404)
sign_in(rogue)
check("…and signing in demotes the stored role, audited",
      sql(f'select role from "User" where id = {lit(rogue_id)}') == "member" and audits("staff.role_revoked", f'and "subjectId" = {lit(rogue_id)}') == 1)

print("== ENG-46: the back office is back office only ==")
sx = C()
r = sx.call("/auth/verify-code", {"email": VERIFIER_EMAIL, "code": new_code(VERIFIER_EMAIL), "accept_privacy": True})
check("ENG-47: a staff address at the user sign-in gets the wrong-code answer and no session",
      r[0] == 422 and err(r) == "INVALID_CODE" and sx.call("/me")[0] == 401 and sx.call("/staff/me")[0] == 404, r)
for path in ("/discover", "/messages", "/household", "/profile", "/onboarding", "/notifications", "/settings", "/members/x"):
    st, loc = first_hop(staff_c, path)
    check(f"a staff session doesn't open the product: {path} → /signin", st in (303, 307, 308) and (loc or "").endswith("/signin"), f"{st} {loc}")
for method, path in [("GET", "/recommendations"), ("GET", "/users/x"), ("POST", "/introductions"), ("GET", "/conversations"),
                     ("GET", "/households/current"), ("PATCH", "/me/profile"), ("PATCH", "/me/search"), ("GET", "/notifications")]:
    r = staff_c.call(path, {} if method != "GET" else None, method)
    check(f"a staff session gets nothing from {method} {path}", r[0] in (401, 404), f"{r[0]} {err(r)}")
check("staff use /staff/me, not the user /me", staff_c.call("/staff/me")[0] == 200 and staff_c.call("/me")[0] == 401)
st, hdrs_bo, html = staff_c.raw("/staff")
check("no framing anywhere (SEC-15): X-Frame-Options DENY and frame-ancestors 'none'",
      hdrs_bo.get("x-frame-options") == "DENY" and "frame-ancestors 'none'" in hdrs_bo.get("content-security-policy", "")
      and C().raw("/")[1].get("x-frame-options") == "DENY", hdrs_bo.get("x-frame-options"))
check("the back office renders its own shell: no member nav, no Feedback pill",
      st == 200 and "Back office" in html and 'aria-label="Main"' not in html and ">Discover<" not in html and ">Household<" not in html, st)
st, loc = first_hop(admin_c, "/staff")
check("admins open /staff directly", st == 200, st)

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
# A staff account with a full, verified, published Lagos/London profile still never appears.
sql(f'''update "Profile" set "publicationStatus" = 'published', journey = 'find_together', bio = {lit(BIO)} where "userId" = {lit(staff_id)}''')
sql(f'''update "Search" s set status = 'active', "cityId" = o."cityId", currency = o.currency, "rentMinMinor" = o."rentMinMinor", "rentMaxMinor" = o."rentMaxMinor",
        "rentPeriod" = o."rentPeriod", "moveMode" = o."moveMode", "earliestDate" = o."earliestDate", "latestDate" = o."latestDate",
        "stayMinMonths" = o."stayMinMonths", "stayMaxMonths" = o."stayMaxMonths", gender = o.gender
        from "Search" o where o."userId" = {lit(b_id)} and s."userId" = {lit(staff_id)}''')
sql(f'''insert into "SearchArea"(id, "searchId", "areaId") select {lit("sa" + RUN)}, id, 'hackney' from "Search" where "userId" = {lit(staff_id)} on conflict do nothing''')
sql(f'''insert into "PreferenceAnswer"(id, "searchId", dimension, "ownAnswer", "acceptedValues")
        select {lit("pa" + RUN)} || p.dimension, s.id, p.dimension, p."ownAnswer", p."acceptedValues" from "PreferenceAnswer" p, "Search" s
        where p."searchId" = (select id from "Search" where "userId" = {lit(b_id)}) and s."userId" = {lit(staff_id)} on conflict do nothing''')
sql(f'''insert into "VerificationCheck"(id, "userId", category, status, points) values ({lit("vc" + RUN)}, {lit(staff_id)}, 'identity', 'verified', 40)
        on conflict ("userId", category) do update set status = 'verified' ''')
check("a staff account never appears in recommendations", staff_id not in [c["userId"] for c in d(a.call("/recommendations"))["candidates"]])
check("…or as a profile (404)", a.call("/users/" + staff_id)[0] == 404)
check("…and can't be introduced (404)", a.call("/introductions", {"target_user_id": staff_id, "text": INTRO})[0] == 404)
r = a.call("/me/search/publish", {})
check("re-publishing never undoes a verified identity", r[0] == 200 and sql(f'select status from "VerificationCheck" where "userId" = {lit(a_id)} and category = \'identity\'') == "verified")

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

print("== HM-03: parallel guesses can't beat the attempt cap ==")
g_email = f"beta-guess-{RUN}@example.com"
sql_account(g_email)
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
gc = C()
r = gc.call("/auth/verify-code", {"email": g_email, "code": code, "accept_privacy": True})
check("10 failed guesses an hour locks the address, even with a fresh correct code", r[0] == 429 and err(r) == "TOO_MANY_ATTEMPTS", f"{r[0]} {err(r)}")
check("…with Retry-After", gc.headers.get("retry-after") == "3600", gc.headers.get("retry-after"))

print("== HM-08: emailed code requests are capped per IP ==")
cap_ip = f"192.0.2.{random.randint(100, 250)}"
codes = [C().call("/auth/request-code", {"email": f"beta-cap{i}-{RUN}@example.com"}, ip=cap_ip) for i in range(12)]
first_429 = next((i for i, r in enumerate(codes) if r[0] == 429), None)
check("an IP is capped within 11 requests an hour, unknown addresses included",
      first_429 is not None and first_429 <= 10 and err(codes[first_429]) == "RATE_LIMITED", f"first 429 at #{first_429}")

print("== HM-08: IPv6 is capped per /64 ==")
net = f"2001:db8:{int(RUN[-4:]) % 65536:x}:{int(RUN[:4]) % 65536:x}"
v6 = [C().call("/auth/request-code", {"email": f"beta-v6-{i}-{RUN}@example.com"}, ip=f"{net}::{i + 1:x}") for i in range(11)]
check("10 addresses in one /64 share a cap", all(r[0] != 429 for r in v6[:10]) and v6[10][0] == 429 and err(v6[10]) == "RATE_LIMITED",
      [r[0] for r in v6])
r = C().call("/auth/request-code", {"email": f"beta-v6-other-{RUN}@example.com"}, ip=f"2001:db8:ffff:{int(RUN[:4]) % 65536:x}::1")
check("another /64 isn't affected", r[0] != 429, f"{r[0]} {err(r)}")

print("== HM-08: a burst can't beat the per-email cap ==")
burst_email = f"beta-burst-{RUN}@example.com"
sql_account(burst_email)
with ThreadPoolExecutor(max_workers=20) as pool:
    burst = list(pool.map(lambda i: C().call("/auth/request-code", {"email": burst_email}), range(20)))
made = int(sql(f'select count(*) from "AuthCode" where email = {lit(burst_email)}'))
check("20 parallel requests for one address create at most 5 codes", made == 5, f"codes={made}, statuses={sorted(r[0] for r in burst)}")
unknown_burst = f"beta-burst-unknown-{RUN}@example.com"
ub = [C().call("/auth/request-code", {"email": unknown_burst}) for _ in range(6)]
mb = [r[0] for r in burst]
check("an unknown address hits the same per-address cap at the 6th request, same body (HM-28)",
      [r[0] for r in ub] == [200] * 5 + [429] and mb.count(200) == 5 and ub[5][1]["error"] == next(r for r in burst if r[0] == 429)[1]["error"],
      [r[0] for r in ub])

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
check("…after the response floor", took >= 0.4, f"{took:.3f}s")
check("…and no code is created or sent", sql(f'select count(*) from "AuthCode" where email = {lit(m_email)}') == "0" and not mails_to(m_email))
check("…and the refusal is logged", sql(f'''select count(*) from "AuditEvent" where "eventType" = 'auth.code_requested' and action = 'dropped_sitewide_cap' and "occurredAt" > now() - interval '1 minute' ''') != "0")
r2 = C().call("/auth/request-code", {"email": f"beta-floodnew-{RUN}@example.com"}, ip="192.0.2.12")
check("an unknown address gets the identical 429 (no new signal)", r2[0] == 429 and r2[1]["error"] == r[1]["error"], f"{r2[0]} {err(r2)}")
sql(f'delete from "AuthCode" where email = {lit(staff_email)}')
before_staff = len(mails_to(staff_email))
cs = C()
r = cs.call("/auth/request-code", {"email": staff_email}, ip="192.0.2.11")
check("a staff address over the cap gets the identical 429…", r[0] == 429 and err(r) == "RATE_LIMITED" and r[1]["error"]["message"] == BUSY and cs.headers.get("retry-after") == "3600", r)
time.sleep(1)
check("…and no user code is created or sent (staff sign in at /staff/signin)",
      sql(f'select count(*) from "AuthCode" where email = {lit(staff_email)} and decoy = false and scope is null') == "0" and len(mails_to(staff_email)) == before_staff)
sql(f'delete from "AuditEvent" where "resourceId" like {lit(fill + "%")}')

print("== ENG-04: beta shows checks, never a score ==")
r = b.call("/users/" + a_id)
cred = d(r).get("credibility", {})
check("public profile has only the checks list", r[0] == 200 and set(cred.keys()) == {"checks"}, cred)
cats = {c["category"]: c for c in cred.get("checks", [])}
check("identity is listed with a month, not a timestamp",
      "identity" in cats and all(len(c["checkedMonth"]) == 7 and c["checkedMonth"][4] == "-" for c in cats.values()), cats)
check("no score anywhere in the profile JSON", "/100" not in json.dumps(d(r)) and '"score"' not in json.dumps(d(r)))
recs = d(b.call("/recommendations"))["candidates"]
check("recommendations carry idChecked, not a score", recs and all(c.get("idChecked") is True and "score" not in c for c in recs))
me = d(p_.call("/me")).get("credibility", {})
check("own /me: no score; pending identity shown as pending",
      set(me.keys()) == {"checks"} and any(c["category"] == "identity" and c["status"] == "pending" for c in me["checks"]), me)
p_id = user_id(sql(f'select email from "User" where email like {lit("beta-pending-" + RUN + "%")}'))
sql(f'update "VerificationCheck" set "checkedAt" = \'2026-01-15\' where "userId" = {lit(p_id)} and category = \'identity\'')
r = staff_c.call(f"/staff/verifications/{p_id}", {"action": "approve"})
check("HM-39: the older identity queue is gone in beta (404 for list and approve)",
      r[0] == 404 and staff_c.call("/staff/verifications")[0] == 404 and admin_c.call("/staff/verifications")[0] == 404, r[0])
check("…and nothing was granted", sql(f'select status from "VerificationCheck" where "userId" = {lit(p_id)} and category = \'identity\'') == "manual_review")

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
# Approval-first sign-up (spec §6): apply → staff review + ID call → approve → activate →
# discover → intro → chat → block/report → household → feedback → survey → export/delete.
# ------------------------------------------------------------------------------------------
print("== Case 1: apply at /join ==")
ada = f"beta-ada-app-{RUN}@example.com"
r = C().call("/applications/start", {"email": ada})
check("step 1 needs the privacy tick: 422 CONSENT_REQUIRED", r[0] == 422 and err(r) == "CONSENT_REQUIRED", r)
r = C().call("/applications/start", {"email": "a@b.co,d@e.fg", "consent_privacy": True})
check("step 1 rejects two addresses in one field (HM-32)", r[0] == 422 and err(r) == "VALIDATION")
start_new = C().call("/applications/start", {"email": ada.upper(), "consent_privacy": True})
start_member = C().call("/applications/start", {"email": b_email, "consent_privacy": True})
check("step 1: the same 200 for a new address and a member",
      start_new[0] == start_member[0] == 200 and d(start_new) == d(start_member) and not d(start_new).get("sink_code"), d(start_new))
code = login_code(ada)
check("the code is emailed (E0) to the address itself", bool(code))
check("nothing is created before the code is used", user_id(ada) == "")
ada_c = C()
r = ada_c.call("/applications/verify", {"email": ada, "code": "000000"})
check("a wrong code: 422 INVALID_CODE", r[0] == 422 and err(r) == "INVALID_CODE")
r = ada_c.call("/applications/verify", {"email": ada, "code": code})
check("verify: an applicant with a draft application", r[0] == 200 and d(r).get("outcome") == "application" and d(r)["application"]["status"] == "draft"
      and d(r)["application"]["can_edit"] is True, r)
ada_id = user_id(ada)
check("account is an applicant with the privacy version recorded, email verified",
      sql(f'select "accountStatus" || \'/\' || "privacyConsentVersion" || \'/\' || "emailVerified" from "User" where id = {lit(ada_id)}') == "applicant/privacy-v2/true")
check("application.started audited", audits("application.started", f'and "actorId" = {lit(ada_id)}') == 1)
me = d(ada_c.call("/me"))
check("/me works for applicants: scope, status, application", me.get("accountStatus") == "applicant" and me.get("sessionScope") == "application"
      and me.get("application", {}).get("status") == "draft" and me.get("nameLocked") is False, {k: me.get(k) for k in ("accountStatus", "sessionScope", "nameLocked")})

print("== Case 9: an application session can't reach member data ==")
for method, path in [("GET", "/recommendations"), ("GET", f"/users/{b_id}"), ("GET", "/users/does-not-exist"), ("GET", "/introductions"),
                     ("POST", "/introductions"), ("GET", "/conversations"), ("POST", "/households"), ("GET", "/households/current"),
                     ("GET", "/notifications"), ("POST", "/me/search/publish"), ("POST", "/me/search/status"), ("POST", "/blocks"),
                     ("POST", "/reports"), ("GET", "/staff/applications")]:
    body = {} if method == "POST" else None
    r = ada_c.call(path, body, method)
    check(f"applicant {method} {path}: 404 NOT_FOUND", r[0] == 404 and err(r) == "NOT_FOUND", f"{r[0]} {err(r)}")
st, loc = first_hop(ada_c, "/discover")
check("the member pages send an applicant back to /join", st in (303, 307, 308) and (loc or "").endswith("/join"), f"{st} {loc}")

print("== Case 15: incomplete application ==")
r = ada_c.call("/applications/submit", {})
check("submit an empty draft: 422 INCOMPLETE listing the missing fields",
      r[0] == 422 and err(r) == "INCOMPLETE" and {"journey", "displayName", "bio", "cityId", "areaIds", "preferences"} <= set(r[1]["error"]["field_errors"] or {}), r)
check("…and the draft is kept", sql(f'select status from "Application" where "userId" = {lit(ada_id)}') == "draft")
ada_c.call("/me/profile", {"journey": "find_together", "displayName": "Ada", "bio": BIO}, method="PATCH")
ada_c.call("/me/search", {"cityId": "lagos", "areaIds": ["yaba"], **LAGOS_MONEY, "moveMode": "undecided", "stayMinMonths": 6, "stayMaxMonths": 12}, method="PATCH")
ada_c.call("/me/search", {"gender": "woman", "preferences": PREFS}, method="PATCH")
r = ada_c.call("/applications/submit", {})
check("undecided dates: 422 UNDECIDED_DATES", r[0] == 422 and err(r) == "UNDECIDED_DATES", r)
r = ada_c.call("/me/search", DATES, method="PATCH")
check("autosave works for applicants (PATCH /me/search)", r[0] == 200, r)

print("== Case 1: submit ==")
before = len(mails_to(ada))
r = ada_c.call("/applications/submit", {"survey_opt_in": True})
check("submit: 200, status submitted", r[0] == 200 and d(r)["application"]["status"] == "submitted" and d(r)["application"]["submitted_at"], r)
e1 = wait_mail(ada, lambda m: "application" in m.get("subject", "").lower(), after=before)
status_link = re.search(r"https?://\S+/join/status\?t=([A-Za-z0-9_-]+)", (e1 or {}).get("text", ""))
check("E1 sent with the status magic link", bool(e1 and status_link), (e1 or {}).get("subject"))
check("application.submitted and email.sent audited, no address in the audit log",
      audits("application.submitted", f'and "actorId" = {lit(ada_id)}') == 1 and audits("email.sent", f'and "subjectId" = {lit(ada_id)} and "resourceId" = \'E1\'') == 1
      and sql(f'''select count(*) from "AuditEvent" where ("safeAfter" like {lit('%' + ada + '%')} or "safeBefore" like {lit('%' + ada + '%')})''') == "0")
check("not published by submitting", sql(f'select "publicationStatus" from "Profile" where "userId" = {lit(ada_id)}') == "draft")
check("survey opt-in recorded from the application",
      audits("consent.survey_granted", f'''and "actorId" = {lit(ada_id)} and "safeAfter" like '%survey-v1%' and "safeAfter" like '%onboarding%' ''') == 1)
check("resubmitting: 409", ada_c.call("/applications/submit", {})[0] == 409)
r = C().call("/applications/status?t=" + (status_link.group(1) if status_link else "x"))
check("the magic link shows the status, signed out and read-only",
      r[0] == 200 and d(r)["application"]["status"] == "submitted" and d(r)["application"]["read_only"] is True and d(r)["application"]["can_withdraw"] is False
      and ada not in json.dumps(d(r)) and "Ada" not in json.dumps(d(r)), r)
check("a bad token: 404", C().call("/applications/status?t=" + "x" * 43)[0] == 404)
check("answers still editable while submitted", ada_c.call("/me/profile", {"bio": BIO + " Edited."}, method="PATCH")[0] == 200)

print("== Case 14: London is waitlisted (F4) ==")
lon = f"beta-lon-app-{RUN}@example.com"
lon_c, r = start_application(lon)
fill_application(lon_c, "Lola", city="london", area="hackney")
before = len(mails_to(lon))
r = lon_c.call("/applications/submit", {})
check("London: waitlisted", r[0] == 200 and d(r)["application"]["status"] == "waitlisted" and d(r)["application"]["city_open"] is False, r)
e5 = wait_mail(lon, lambda m: "application" in m.get("subject", "").lower(), after=before)
check("E1 sent with the waitlist (E5) wording", e5 and "London" in e5["text"])
subs = [x["id"] for x in d(admin_c.call("/staff/applications?status=submitted"))["applications"]]
waits = [x["id"] for x in d(admin_c.call("/staff/applications?status=waitlisted"))["applications"]]
lon_aid, ada_aid = application_id(lon), application_id(ada)
check("not in the submitted filter; in the waitlisted one", lon_aid not in subs and lon_aid in waits and ada_aid in subs)
r = staff_act(admin_c, lon_aid, "approve", id_check_confirmed=True, id_check_method="video")
check("approving a city that isn't open: 409", r[0] == 409 and err(r) == "STATE_CONFLICT", r)

print("== Cases 2, 12, 13: the Applications queue ==")
check("members and visitors get 404 on the queue", flood_c.call("/staff/applications")[0] == 404 and C().call("/staff/applications")[0] == 404)
r = admin_c.call("/staff/applications?status=nope")
check("bad filter: 422", r[0] == 422)
row = next((x for x in d(admin_c.call("/staff/applications?status=submitted&city=lagos&area=yaba"))["applications"] if x["id"] == ada_aid), None)
check("city and area filters; waiting label and cluster hint", row and row["waiting_label"] == "On time" and "area_matches" in row["cluster"], row)
r = mod_c.call(f"/staff/applications/{ada_aid}")
detail = d(r).get("application", {})
check("a moderator can view the detail", r[0] == 200 and detail.get("email") == ada and detail.get("can_act") is False)
check("gender and preference are hidden by default", "woman" not in json.dumps(detail) and "gender" not in json.dumps(detail).replace("private_hidden", ""), [k for k in detail if "gender" in k])
check("viewing is audited", audits("staff.application_viewed", f'and "resourceId" = {lit(ada_aid)}') >= 1)
r = mod_c.call(f"/staff/applications/{ada_aid}/reveal", {})
check("reveal shows them, audited", d(r).get("gender") == "woman" and audits("staff.application_private_revealed", f'and "resourceId" = {lit(ada_aid)}') == 1)
r = staff_act(mod_c, ada_aid, "approve", id_check_confirmed=True, id_check_method="video")
check("case 12: a moderator approving gets 404", r[0] == 404 and err(r) == "NOT_FOUND", r)
sql(f'''insert into "Application"(id, "userId", status, "submittedAt", "updatedAt") values ({lit("self" + RUN)}, {lit(staff_id)}, 'submitted', now(), now())
        on conflict ("userId") do update set status = 'submitted' ''')
self_aid = sql(f'select id from "Application" where "userId" = {lit(staff_id)}')
r = staff_c.call(f"/staff/applications/{self_aid}", {"action": "approve", "id_check_confirmed": True, "id_check_method": "video"})
check("case 12: approving your own application gets 404", r[0] == 404 and err(r) == "NOT_FOUND", r)
check("…and viewing it too", staff_c.call(f"/staff/applications/{self_aid}")[0] == 404 and self_aid not in json.dumps(d(staff_c.call("/staff/applications"))))
sql(f'delete from "Application" where id = {lit(self_aid)}')
r = staff_act(staff_c, ada_aid, "approve", id_check_confirmed=True, id_check_method="video", own_account=True)
check("declaring your own account needs a note: 422", r[0] == 422 and "relationship_note" in (r[1]["error"]["field_errors"] or {}), r)
r = staff_act(staff_c, ada_aid, "approve", id_check_method="video")
check("approve without the ID confirmation: 422", r[0] == 422 and "id_check_confirmed" in (r[1]["error"]["field_errors"] or {}), r)
r = staff_c.call(f"/staff/applications/{ada_aid}", {"action": "start_review", "expected_version": 0})
check("a stale version: 409 VERSION_CONFLICT", r[0] == 409 and err(r) == "VERSION_CONFLICT", r)
r = staff_act(staff_c, ada_aid, "start_review")
check("start review → in_review", r[0] == 200 and d(r)["application"]["status"] == "in_review", r)
check("answers lock once review starts", ada_c.call("/me/profile", {"bio": BIO}, method="PATCH")[0] == 409)
call_at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).replace(microsecond=0).isoformat()
before = len(mails_to(ada))
r = staff_act(staff_c, ada_aid, "call_booked", call_at=call_at, send_email=True)
check("call booked, with E4", r[0] == 200 and d(r)["application"]["status"] == "call_booked" and d(r)["email_status"] == "sent", r)
e4 = wait_mail(ada, lambda m: "ID call" in m.get("subject", ""), after=before)
check("E4 names the time in Lagos time", e4 and "Lagos time" in e4["subject"])
check("the applicant's status shows the call time", d(ada_c.call("/applications/status"))["application"]["call_at"])
before = len(mails_to(ada))
r = staff_act(staff_c, ada_aid, "approve", id_check_confirmed=True, id_check_method="video")
act_code, act_url = d(r).get("activation_code"), d(r).get("activation_url", "")
check("case 2: approve → 200, activation link, E2 sent", r[0] == 200 and d(r)["application"]["status"] == "approved" and d(r)["email_status"] == "sent"
      and act_url.endswith("/invite/" + str(act_code)), r)
e2 = wait_mail(ada, lambda m: "approved" in m.get("subject", "").lower(), after=before)
check("E2 carries the link and the code", e2 and act_url in e2["html"] and act_code in e2["text"])
check("identity verified, application approved, reviewer and method recorded",
      sql(f'select status from "VerificationCheck" where "userId" = {lit(ada_id)} and category = \'identity\'') == "verified"
      and sql(f'select status || \'/\' || "reviewedBy" || \'/\' || "idCheckMethod" from "Application" where id = {lit(ada_aid)}') == f"approved/{staff_id}/video")
check("case 13: no phone check and phoneVerified stays false",
      sql(f'select count(*) from "VerificationCheck" where "userId" = {lit(ada_id)} and category = \'phone\'') == "0"
      and sql(f'select "phoneVerified" from "User" where id = {lit(ada_id)}') == "f")
check("not visible to members until activation", sql(f'select "publicationStatus" from "Profile" where "userId" = {lit(ada_id)}') == "draft"
      and b.call("/users/" + ada_id)[0] == 404)
check("approving twice: 409", staff_act(staff_c, ada_aid, "approve", id_check_confirmed=True, id_check_method="video")[0] == 409)
check("approval audited", audits("application.approved", f'and "resourceId" = {lit(ada_aid)} and "actorId" = {lit(staff_id)}') == 1)
check("the applicant still can't reach member routes", ada_c.call("/recommendations")[0] == 404)

print("== Cases 5–8: sign-in gives every address the identical answer ==")
SIGNIN_TARGETS_BUILT = True
# Applicants in each state, a declined one, a suspended member, an unknown address — and an
# active member for comparison.
dru = f"beta-dru-app-{RUN}@example.com"
start_application(dru)  # draft
sub = f"beta-sub-app-{RUN}@example.com"
sub_c, _ = start_application(sub)
fill_application(sub_c, "Sule")
sub_c.call("/applications/submit", {"survey_opt_in": True})
dec = f"beta-dec-app-{RUN}@example.com"
dec_c, _ = start_application(dec)
fill_application(dec_c, "Dayo")
dec_c.call("/applications/submit", {})
dec_aid = application_id(dec)
before = len(mails_to(dec))
r = staff_act(staff_c, dec_aid, "decline", reason="nope")
check("decline needs a reason from the allow-list: 422", r[0] == 422)
r = staff_act(staff_c, dec_aid, "decline", reason="not_genuine")
check("decline → declined, reapply in 30 days, E3 sent", r[0] == 200 and d(r)["application"]["status"] == "declined" and d(r)["email_status"] == "sent"
      and sql(f'''select ("reapplyAfter" - now()) > interval '29 days' from "Application" where id = {lit(dec_aid)}''') == "t", r)
e3 = wait_mail(dec, lambda m: "About your" in m.get("subject", ""), after=before)
check("E3 is generic: no reason given", e3 and "not_genuine" not in e3["text"] + e3["html"] and "genuine" not in e3["text"].lower())
susp = f"beta-susp-{RUN}@example.com"
sql_account(susp, status="suspended")
unknown = f"beta-unknown-{RUN}@example.com"
active = f"beta-active-{RUN}@example.com"
sql_account(active)
SIGNIN_MSG = "If you have an approved Peabudy account, we've sent a code. New here? Apply to join."
targets = {"unknown": unknown, "applicant draft": dru, "applicant submitted": sub, "applicant approved, not activated": ada,
           "declined": dec, "suspended": susp, "staff address": MODERATOR_EMAIL, "active member": active}
time.sleep(2)  # let earlier sends land
mail_before = {k: len(mails_to(v)) for k, v in targets.items()}
results, timings = {}, {k: [] for k in targets}
for _ in range(3):
    for k, addr in targets.items():
        t0 = time.time()
        results[k] = C().call("/auth/request-code", {"email": addr})
        timings[k].append(time.time() - t0)
time.sleep(2.5)  # sends happen after the response
ref = results["active member"]
check("the active member gets 200 with the agreed message and a code", ref[0] == 200 and d(ref) == {"status": "sent", "message": SIGNIN_MSG}
      and len(mails_to(active)) > mail_before["active member"], d(ref))
for k in targets:
    if k == "active member":
        continue
    r = results[k]
    check(f"{k}: identical status and body, no email", r[0] == ref[0] and d(r) == d(ref) and len(mails_to(targets[k])) == mail_before[k], f"{r[0]} {d(r)}")
med = {k: statistics.median(v) for k, v in timings.items()}
spread = max(med.values()) - min(med.values())
check("timing: medians within 150 ms of each other (floor + send after the response)", spread < 0.15, {k: round(v, 3) for k, v in med.items()})
for addr in targets.values():
    reset_email_bucket(addr)
before = len(mails_to(sub))
C().call("/applications/start", {"email": sub, "consent_privacy": True})
code_from_join = login_code(sub, after=before)
r = C().call("/auth/verify-code", {"email": sub, "code": code_from_join, "accept_privacy": True})
new_code(active)
wrong = C().call("/auth/verify-code", {"email": active, "code": "000001", "accept_privacy": True})
check("an applicant's real code at /signin looks exactly like a wrong code", r[0] == wrong[0] == 422 and r[1]["error"] == wrong[1]["error"], r)
check("no member session for the applicant", sql(f'select count(*) from "Session" where "userId" = {lit(user_id(sub))} and scope = \'member\'') == "0")

print("== HM-35: a wrong code at /signin looks the same for every address ==")
strip = lambda r: (r[0], json.dumps({k: v for k, v in r[1].items() if k != "meta"}, sort_keys=True))
for addr in targets.values():
    reset_email_bucket(addr)
    sql(f'delete from "AuthCode" where email = {lit(addr)}')
wrongs = {}
for k, addr in targets.items():
    C().call("/auth/request-code", {"email": addr})
    wrongs[k] = strip(C().call("/auth/verify-code", {"email": addr, "code": "000000", "accept_privacy": True}))
ref_w = wrongs["active member"]
check("the active member's wrong code: 422 INVALID_CODE", ref_w[0] == 422 and '"INVALID_CODE"' in ref_w[1], ref_w)
for k, w in wrongs.items():
    if k != "active member":
        check(f"{k}: byte-identical status and body for a wrong code", w == ref_w, w)
check("every address got a code row (a never-sent decoy for non-users)",
      all(sql(f'select count(*) from "AuthCode" where email = {lit(addr)}') == "1" for addr in targets.values()))
lock = {}
for k in ("unknown", "suspended", "active member"):
    for _ in range(4):
        C().call("/auth/verify-code", {"email": targets[k], "code": "000000", "accept_privacy": True})
    lock[k] = strip(C().call("/auth/verify-code", {"email": targets[k], "code": "000000", "accept_privacy": True}))
check("…and the per-code attempt cap answers identically (TOO_MANY_ATTEMPTS)",
      lock["unknown"] == lock["suspended"] == lock["active member"] and lock["unknown"][0] == 429, lock)

print("== Case 11: reapplying before the date ==")
c11, r = start_application(dec)
check("a declined applicant sees the status page with the date", d(r).get("outcome") == "application" and d(r)["application"]["status"] == "declined"
      and d(r)["application"]["reapply_after"], r)
check("…and no new application is created", sql(f'select count(*) from "Application" where "userId" = {lit(user_id(dec))}') == "1"
      and sql(f'select status from "Application" where id = {lit(dec_aid)}') == "declined")
check("…and can't edit answers", c11.call("/me/profile", {"bio": BIO}, method="PATCH")[0] == 409)
sql(f'''update "Application" set "reapplyAfter" = now() - interval '1 minute' where id = {lit(dec_aid)}''')
_, r = start_application(dec)
check("after the date the same application reopens as a draft, answers kept", d(r)["application"]["status"] == "draft"
      and sql(f'select "displayName" from "User" where email = {lit(dec)}') == "Dayo")

print("== Withdraw ==")
wd_c, _ = start_application(f"beta-wd-app-{RUN}@example.com")
r = wd_c.call("/applications/withdraw", {})
check("withdraw → withdrawn", r[0] == 200 and d(r)["application"]["status"] == "withdrawn", r)
check("withdrawing twice: 409", wd_c.call("/applications/withdraw", {})[0] == 409)

print("== Cases 3 and 10: activation ==")
r = C().call(f"/invites/{act_code}")
check("the activation link is valid, with a masked address", d(r).get("valid") is True and d(r).get("email_hint", "").startswith("be•••@"), d(r))
check("lower case and hyphens work", d(C().call(f"/invites/{act_code[:4].lower()}-{act_code[4:].lower()}")).get("valid") is True)
check("case 10: signed in as someone else, the link is invalid", b.call(f"/invites/{act_code}")[0] == 200 and d(b.call(f"/invites/{act_code}")) == {"valid": False})
r = b.call(f"/invites/{act_code}", {})
check("case 10: …and can't send a code", r[0] == 422 and err(r) == "INVITE_INVALID", r)
r = b.call("/auth/verify-code", {"activation_code": act_code, "code": "123456"})
check("case 10: …or activate", r[0] == 422 and err(r) == "INVITE_INVALID", r)
for bad in ("ABCDEFGH", "not-a-code"):
    check(f"unknown code {bad}: invalid", d(C().call(f"/invites/{bad}")) == {"valid": False} and C().call(f"/invites/{bad}", {})[0] == 422)
before = len(mails_to(ada))
r = ada_c.call(f"/invites/{act_code}", {})
check("Continue: a code is emailed to the approved address", r[0] == 200 and d(r).get("status") == "sent" and not d(r).get("sink_code"), r)
otp = login_code(ada, after=before)
check("…E0 arrives", bool(otp))
r = ada_c.call("/auth/verify-code", {"activation_code": act_code, "code": "000000"})
check("a wrong code: 422 INVALID_CODE, nothing activated", err(r) == "INVALID_CODE" and sql(f'select "accountStatus" from "User" where id = {lit(ada_id)}') == "applicant")
r = ada_c.call("/auth/verify-code", {"activation_code": act_code, "code": otp})
check("case 3: activated, redirect to /discover", r[0] == 200 and d(r).get("activated") is True and d(r).get("redirect") == "/discover", r)
check("account active, profile published, search active",
      sql(f'''select u."accountStatus" || '/' || p."publicationStatus" || '/' || s.status from "User" u join "Profile" p on p."userId" = u.id join "Search" s on s."userId" = u.id where u.id = {lit(ada_id)}''')
      == "active/published/active")
check("one member session; the application session is gone", sql(f'select string_agg(scope, \',\') from "Session" where "userId" = {lit(ada_id)}') == "member")
check("activation audited", audits("application.activated", f'and "actorId" = {lit(ada_id)}') == 1)
check("the code can't be used again", d(C().call(f"/invites/{act_code}")) == {"valid": False}
      and C().call("/auth/verify-code", {"activation_code": act_code, "code": "123456"})[0] == 422)
check("the member can use the app now", ada_c.call("/recommendations")[0] == 200)
me = d(ada_c.call("/me"))
check("/me: active, member scope, name locked, application approved",
      me.get("accountStatus") == "active" and me.get("sessionScope") == "member" and me.get("nameLocked") is True
      and me["application"]["status"] == "approved" and me["application"]["can_withdraw"] is False)
r = ada_c.call("/me/profile", {"displayName": "Adaeze"}, method="PATCH")
check("display name locked after approval (HM-12): 409", r[0] == 409 and err(r) == "STATE_CONFLICT", r)
check("…sending the same name is fine; bio still editable", ada_c.call("/me/profile", {"displayName": "Ada", "bio": BIO}, method="PATCH")[0] == 200)
r = ada_c.call("/me/search", {"cityId": "london"}, method="PATCH")
check("city locked after approval (R5): 422 with a clear message", r[0] == 422 and "cityId" in (r[1]["error"]["field_errors"] or {}) and "hello@peabudy.com" in r[1]["error"]["message"], r)
r = ada_c.call("/me/search", {"cityId": "lagos", "areaIds": ["yaba", "surulere"]}, method="PATCH")
check("…the same city and other areas in it stay editable", r[0] == 200, r)
r = ada_c.call("/me/search", {"stayMaxMonths": 18}, method="PATCH")
check("matching changes still write a search version", r[0] == 200 and int(sql(f'select count(*) from "SearchVersion" sv join "Search" s on s.id = sv."searchId" where s."userId" = {lit(ada_id)}')) >= 2)

print("== Resend and revoke ==")
sub_aid = application_id(sub)
r = staff_act(admin_c, sub_aid, "approve", id_check_confirmed=True, id_check_method="video")
check("HM-36: approving straight from submitted (answers still editable): 409", r[0] == 409 and err(r) == "STATE_CONFLICT", r)
r = admin_c.call(f"/staff/applications/{sub_aid}", {"action": "decline", "reason": "other"})
check("HM-36: decline without expected_version: 422", r[0] == 422 and "expected_version" in (r[1]["error"]["field_errors"] or {}), r)
v0 = app_version(sub_aid)
check("an applicant's edit while submitted moves the version",
      sub_c.call("/me/profile", {"displayName": "Suleiman"}, method="PATCH")[0] == 200 and app_version(sub_aid) == v0 + 1)
r = admin_c.call(f"/staff/applications/{sub_aid}", {"action": "start_review", "expected_version": v0})
check("HM-36: acting on the version staff saw before the edit: 409 VERSION_CONFLICT", r[0] == 409 and err(r) == "VERSION_CONFLICT", r)
check("start review on the fresh version", staff_act(admin_c, sub_aid, "start_review")[0] == 200)
r = admin_c.call(f"/staff/applications/{sub_aid}", {"action": "approve", "expected_version": v0, "id_check_confirmed": True, "id_check_method": "video"})
check("HM-36: approve with the old version: 409", r[0] == 409 and err(r) == "VERSION_CONFLICT", r)
r = staff_act(admin_c, sub_aid, "approve", id_check_confirmed=True, id_check_method="video")
first_code = d(r)["activation_code"]
r = staff_act(admin_c, sub_aid, "resend_activation")
second = d(r).get("activation_code")
check("resend: a new code, emailed", r[0] == 200 and second and second != first_code and d(r)["email_status"] == "sent")
check("the old code stops working, the new one works", d(C().call(f"/invites/{first_code}")) == {"valid": False} and d(C().call(f"/invites/{second}"))["valid"] is True)
sql(f'''update "Invite" set "expiresAt" = now() - interval '1 minute' where "applicationId" = {lit(sub_aid)} and "revokedAt" is null''')
check("an expired code: invalid", d(C().call(f"/invites/{second}")) == {"valid": False})
before_checks = audits("invite.checked")
C().call("/auth/verify-code", {"activation_code": "ABCDEFGH", "code": "123456"})
check("HM-42: activation attempts at verify-code count towards the activation caps", audits("invite.checked") == before_checks + 1)
r = sub_c.call("/applications/withdraw", {})
check("HM-38: withdrawing an approved application removes the identity check and adultEligible",
      r[0] == 200 and sql(f'''select count(*) from "VerificationCheck" where "userId" = {lit(user_id(sub))} and category = 'identity' ''') == "0"
      and sql(f'select "adultEligible" from "User" where id = {lit(user_id(sub))}') == "f", r)

print("== Invite checks are rate-limited ==")
ipx = next_ip()
statuses = [C().call("/invites/ABCDEFGH", ip=ipx)[0] for _ in range(31)]
check("30 checks an hour per connection (31st is 429)", statuses[:30] == [200] * 30 and statuses[30] == 429, statuses[-3:])
cap = f"e2e-cap-{RUN}"
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       select {lit(cap)} || g, 'invite.checked', 'service', 'ip', {lit(cap)} || g, 'check', 'allowed', now() from generate_series(1, 300) g''')
r = C().call("/invites/ABCDEFGH")
check("300 checks site-wide in an hour: the next is 429, from any connection", r[0] == 429 and err(r) == "RATE_LIMITED", r[0])
sql(f'delete from "AuditEvent" where "resourceId" like {lit(cap + "%")}')

print("== Case 4: sign in later ==")
before = len(mails_to(ada))
r = C().call("/auth/request-code", {"email": ada})
k = login_code(ada, after=before)
r = C().call("/auth/verify-code", {"email": ada, "code": k})
check("an activated member signs in with an emailed code", r[0] == 200 and bool(k), r)
sql(f'''update "User" set "privacyConsentVersion" = 'privacy-v0' where id = {lit(ada_id)}''')
r = C().call("/applications/start", {"email": ada, "consent_privacy": True})
k = login_code(ada, after=before + 1)
r = C().call("/applications/verify", {"email": ada, "code": k})
check("…and /join signs a user in normally too", d(r).get("outcome") == "member" and d(r).get("redirect") == "/discover", r)
check("…recording the current privacy notice ticked at /join step 1 (re-consent)",
      sql(f'select "privacyConsentVersion" from "User" where id = {lit(ada_id)}') == "privacy-v2"
      and audits("auth.consent_recorded", f'''and "actorId" = {lit(ada_id)} and "safeBefore" like '%privacy-v0%' ''') == 1)

print("== Case 3: two activated members see each other ==")
tobi_c, tobi_email, tobi_id = apply_activated("tobi", admin_c)
kemi_c, kemi_email, kemi_id = apply_activated("kemi", admin_c, gender="woman", own_note="Founder's own test account for the Lagos launch")
check("an own-account approval is audited with the note", sql(f'''select count(*) from "AuditEvent" where "eventType" = 'application.approved' and "subjectId" = {lit(kemi_id)}
      and "reasonCode" = 'own_account_declared' and "safeAfter" like '%"own_account":true%' and "safeAfter" not like '%own test account%' ''') == "1")
check("…the note itself stays on the application, not in the audit log",
      sql(f'''select "ownAccount" || '/' || "relationshipNote" from "Application" where "userId" = {lit(kemi_id)}''') == "true/Founder's own test account for the Lagos launch")
cands = [c["userId"] for c in d(ada_c.call("/recommendations")).get("candidates", [])]
check("activated Lagos members discover each other", tobi_id in cands and kemi_id in cands, cands)
check("…both ways", ada_id in [c["userId"] for c in d(tobi_c.call("/recommendations")).get("candidates", [])])
check("an approved-but-not-activated applicant is never a candidate", user_id(sub) not in cands)

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
check("opted in at submit", r[0] == 200 and d(r)["survey_opt_in"] is True and d(r)["survey_opt_in_version"] == "survey-v1")
check("only a boolean is accepted", ada_c.call("/me/preferences", {"survey_opt_in": "yes"}, method="PATCH")[0] == 422)
ada_c.call("/me/preferences", {"survey_opt_in": True}, method="PATCH")
check("opting in again writes no second audit row", audits("consent.survey_granted", f'and "actorId" = {lit(ada_id)}') == 1)
check("signed out: 401", C().call("/me/preferences")[0] == 401)

print("== D17: survey send ==")
SURVEY = {"campaign": f"e2e-{RUN[-6:]}", "survey_url": "https://tally.so/r/e2e-test", "limit": 200}
check("members get 404", ada_c.call("/staff/survey/send", {**SURVEY, "dry_run": True})[0] == 404)
check("non-admin staff get 404", staff_c.call("/staff/survey/send", {**SURVEY, "dry_run": True})[0] == 404)
check("bad campaign / URL: 422", admin_c.call("/staff/survey/send", {**SURVEY, "campaign": "X"})[0] == 422
      and admin_c.call("/staff/survey/send", {**SURVEY, "survey_url": "http://x.com"})[0] == 422)
dry = d(admin_c.call("/staff/survey/send", {**SURVEY, "dry_run": True}))
check("dry run counts and sends nothing", dry.get("dry_run") is True and dry["would_send"] >= 1 and not wait_mail(ada, lambda m: "survey" in m.get("subject", "").lower(), 1), dry)
r = admin_c.call("/staff/survey/send", SURVEY)
check("send: 200, nothing failed", r[0] == 200 and d(r)["failed"] == 0 and d(r)["sent"] >= 1, d(r))
sm = wait_mail(ada, lambda m: "survey" in m.get("subject", "").lower())
ref = re.search(r"https://tally\.so/r/e2e-test\?ref=([0-9a-f]+)", sm["text"] if sm else "")
check("the survey email arrives with a pseudonymous ref (not the account ID)", ref and ada_id not in ref.group(0))
lu = (sm or {}).get("headers", {})
check("List-Unsubscribe (+ one-click) headers set", lu.get("List-Unsubscribe", "").startswith("<http") and lu.get("List-Unsubscribe-Post") == "List-Unsubscribe=One-Click", lu)
check("not sent to members who didn't opt in", not [m for m in mails_to(tobi_email) if "survey" in m.get("subject", "").lower()])
check("not sent to applicants who opted in but aren't members", not [m for m in mails_to(sub) if "survey" in m.get("subject", "").lower()])
check("each send audited, without the address",
      audits("survey.sent", f'and "subjectId" = {lit(ada_id)} and "resourceId" = {lit(SURVEY["campaign"])}') == 1
      and sql(f'''select count(*) from "AuditEvent" where "eventType" = 'survey.sent' and coalesce("safeAfter", '') like {lit('%' + ada + '%')}''') == "0")
r = admin_c.call("/staff/survey/send", SURVEY)
check("a second press sends nobody twice", len([m for m in mails_to(ada) if "survey" in m.get("subject", "").lower()]) == 1, d(r))

print("== ENG-30: survey export ==")
st, hdrs, csv = admin_c.raw("/api/v1/staff/survey/export.csv")
check("admin gets a CSV attachment, no-store", st == 200 and "text/csv" in hdrs.get("content-type", "") and "attachment" in hdrs.get("content-disposition", "") and hdrs.get("cache-control") == "no-store", hdrs)
check("it lists opted-in members only", ada in csv and tobi_email not in csv and csv.startswith("email,first_name,city"))
check("export audited with the row count only", audits("staff.export_survey_optins", f'and "actorId" = {lit(admin_id)}') >= 1)
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
check("unsubscribed people aren't eligible any more", ada not in admin_c.raw("/api/v1/staff/survey/export.csv")[2])
check("Settings shows the change", d(ada_c.call("/me/preferences"))["survey_opt_in"] is False and d(ada_c.call("/me/preferences"))["unsubscribed_at"])

print("== Retired: access requests ==")
check("POST /access-requests is gone", C().call("/access-requests", {"name": "x"})[0] == 404)
check("staff invite creation is gone", admin_c.call("/staff/invites", {})[0] in (404, 405))
st, loc = first_hop(C(), "/request-access")
check("/request-access redirects to /join", st in (307, 308) and (loc or "").endswith("/join"), f"{st} {loc}")
old = f"beta-old-req-{RUN}@example.com"
sql(f'''insert into "AccessRequest"(id, name, email, city, area, "moveInMonth", "consentVersion", status, "createdAt")
       values ({lit("ar" + RUN)}, 'Old', {lit(old)}, 'lagos', 'yaba', 'not_sure', 'privacy-v2', 'pending', now() - interval '31 days')''')
check("purge is admin only: 404 for other staff", staff_c.call("/staff/access-requests/purge", {"dry_run": True})[0] == 404)
r = admin_c.call("/staff/access-requests/purge", {})
check("old access requests can still be purged", r[0] == 200 and sql(f'select count(*) from "AccessRequest" where email = {lit(old)}') == "0", d(r))

print("== R7: application retention ==")
old_draft = f"beta-olddraft-{RUN}@example.com"
od_c, _ = start_application(old_draft)
fill_application(od_c, "Odun")
od_id = user_id(old_draft)
fresh_draft = f"beta-freshdraft-{RUN}@example.com"
start_application(fresh_draft)
old_dec = f"beta-olddec-{RUN}@example.com"
odc, _ = start_application(old_dec)
fill_application(odc, "Obi")
odc.call("/applications/submit", {})
check("decline for the retention test", staff_act(admin_c, application_id(old_dec), "decline", reason="duplicate")[0] == 200)
odec_id = user_id(old_dec)
sql(f'''update "Application" set "updatedAt" = now() - interval '31 days' where "userId" = {lit(od_id)}''')
for t in ("User", "Profile", "Search"):
    col = "id" if t == "User" else '"userId"'
    sql(f'''update "{t}" set "updatedAt" = now() - interval '31 days' where {col} = {lit(od_id)}''')
sql(f'''update "Application" set "reviewedAt" = now() - interval '31 days', "reapplyAfter" = now() + interval '5 days' where "userId" = {lit(odec_id)}''')
check("purge is admin only: 404 for other staff and users",
      staff_c.call("/staff/applications/purge", {"dry_run": True})[0] == 404 and ada_c.call("/staff/applications/purge", {"dry_run": True})[0] == 404)
dry = d(admin_c.call("/staff/applications/purge", {"dry_run": True}))
check("dry run counts the old draft and the old decline, deletes nothing",
      dry.get("dry_run") is True and dry.get("stale_drafts", 0) >= 1 and dry.get("declined", 0) >= 1 and user_id(old_draft) == od_id, dry)
r = admin_c.call("/staff/applications/purge", {})
check("purge deletes the old draft and the old decline: accounts, answers, applications",
      r[0] == 200 and user_id(old_draft) == "" and user_id(old_dec) == ""
      and sql(f'''select count(*) from "Search" where "userId" in ({lit(od_id)}, {lit(odec_id)})''') == "0"
      and sql(f'''select count(*) from "Application" where "userId" in ({lit(od_id)}, {lit(odec_id)})''') == "0", d(r))
check("…keeps a recent draft and every user", user_id(fresh_draft) != "" and user_id(tobi_email) != "")
key = email_key(old_dec)
check("…keeps only a hashed email + reapply date for the decline",
      sql(f'''select count(*) from "ApplicantTombstone" where "emailHash" = {lit(key)}''') == "1"
      and sql(f'''select count(*) from "ApplicantTombstone" where "emailHash" like '%@%' ''') == "0")
check("purge audited with counts only", sql(f'''select count(*) from "AuditEvent" where "eventType" = 'application.purged' and "actorId" = {lit(admin_id)} and "safeAfter" not like '%@%' ''') >= "1")
_, r = start_application(old_dec)
check("the purged, declined person still sees the declined status page with the date (no new draft)",
      d(r).get("outcome") == "application" and d(r)["application"]["status"] == "declined" and d(r)["application"]["reapply_after"], r)
check("…and the tombstone has done its job", sql(f'''select count(*) from "ApplicantTombstone" where "emailHash" = {lit(key)}''') == "0")

print("== ENG-47: the back-office sign-in ==")
LOCK_EMAIL = "e2e-lock@example.com"
nobody = f"beta-notstaff-{RUN}@example.com"
sql(f'''delete from "AuditEvent" where "eventType" in ('staff.setup_requested', 'staff.pw_attempt_addr') and "resourceId" = {lit(email_key(ADMIN_EMAIL))}''')
before_a, before_n = len(mails_to(ADMIN_EMAIL)), len(mails_to(nobody))
t0 = time.time(); ra = C().call("/staff/auth/setup-request", {"email": ADMIN_EMAIL}); ta = time.time() - t0
t0 = time.time(); rn = C().call("/staff/auth/setup-request", {"email": nobody}); tn = time.time() - t0
time.sleep(1.5)
check("setup-request: identical 200 for an allowlisted and an unknown address", strip(ra) == strip(rn) and ra[0] == 200, (ra[1], rn[1]))
check("…in the same time (within 150 ms)", abs(ta - tn) < 0.15, f"{ta:.3f}/{tn:.3f}")
check("…and only the allowlisted address gets the link", len(mails_to(ADMIN_EMAIL)) == before_a + 1 and len(mails_to(nobody)) == before_n)
tok = staff_setup_link(ADMIN_EMAIL, after=before_a)
r = C().call("/staff/auth/setup", {"token": tok, "password": "Password1234"})
check("a very common password is refused (422), the link survives", r[0] == 422 and "password" in (r[1]["error"]["field_errors"] or {}), r)
r = C().call("/staff/auth/setup", {"token": tok, "password": "too short"})
check("a short password is refused", r[0] == 422, r)
r = C().call("/staff/auth/setup", {"token": tok, "password": STAFF_PASSWORD})
check("a good password is set, audited, and old staff sessions end", r[0] == 200 and audits("staff.password_set", f'and "subjectId" = {lit(admin_id)}') >= 1
      and admin_c.call("/staff/me")[0] == 404, r)
check("the stored hash is scrypt, never the password", sql(f'''select "passwordHash" like 'scrypt$32768$8$1$%' and "passwordHash" not like {lit('%' + STAFF_PASSWORD + '%')} from "StaffCredential" where "userId" = {lit(admin_id)}''') == "t")
r = C().call("/staff/auth/setup", {"token": tok, "password": STAFF_PASSWORD + "!"})
check("the link is single-use", r[0] == 422 and err(r) == "INVITE_INVALID", r)
before_a = len(mails_to(ADMIN_EMAIL))
C().call("/staff/auth/setup-request", {"email": ADMIN_EMAIL})
tok2 = staff_setup_link(ADMIN_EMAIL, after=before_a)
sql(f'''update "StaffSetupToken" set "expiresAt" = now() - interval '1 minute' where email = {lit(ADMIN_EMAIL)} and "usedAt" is null''')
check("an expired link is refused", C().call("/staff/auth/setup", {"token": tok2, "password": STAFF_PASSWORD})[0] == 422)
# Wrong password vs right password vs not staff: identical answers.
cw, cr, cn = C(), C(), C()
before_a = len(mails_to(ADMIN_EMAIL))
t0 = time.time(); rw = cw.call("/staff/auth/password", {"email": ADMIN_EMAIL, "password": STAFF_PASSWORD + "x"}); tw = time.time() - t0
t0 = time.time(); rn = cn.call("/staff/auth/password", {"email": nobody, "password": STAFF_PASSWORD}); tn = time.time() - t0
t0 = time.time(); rr = cr.call("/staff/auth/password", {"email": ADMIN_EMAIL, "password": STAFF_PASSWORD}); tr = time.time() - t0
check("password step: identical answer for a wrong password, a right one and a non-staff address",
      strip(rw) == strip(rr) == strip(rn) and rr[0] == 200, (rw[1], rr[1], rn[1]))
check("…in about the same time (within 200 ms)", max(tw, tr, tn) - min(tw, tr, tn) < 0.2, f"{tw:.3f}/{tr:.3f}/{tn:.3f}")
good_code = staff_code(ADMIN_EMAIL, after=before_a)
check("…and only the right password produces an email (one code), with no code in the subject",
      good_code and len([m for m in mails_to(ADMIN_EMAIL)[before_a:] if "back-office sign-in code" in m["subject"]]) == 1
      and not re.search(r"\d{6}", [m for m in mails_to(ADMIN_EMAIL)[before_a:] if "back-office" in m["subject"]][-1]["subject"]))
r = C().call("/staff/auth/verify", {"email": ADMIN_EMAIL, "code": good_code})
check("the code without the password step on this browser: wrong-code answer", r[0] == 422 and err(r) == "INVALID_CODE", r)
r = cw.call("/staff/auth/verify", {"email": ADMIN_EMAIL, "code": good_code})
check("the code with a wrong-password step's cookie: wrong-code answer", r[0] == 422 and err(r) == "INVALID_CODE", r)
r = cr.call("/staff/auth/verify", {"email": ADMIN_EMAIL, "code": good_code})
check("password + code: a staff session, sent to /staff", r[0] == 200 and d(r).get("redirect") == "/staff" and d(r).get("role") == "admin", r)
check("…stored with scope staff and a 12-hour expiry",
      sql(f'''select count(*) from "Session" where "userId" = {lit(admin_id)} and scope = 'staff' and "expiresAt" < now() + interval '12 hours 1 minute' and "expiresAt" > now() + interval '11 hours' ''') == "1")
st, loc = first_hop(cr, "/staff")
check("…and the back office opens", st == 200, st)
admin_c = cr
check("a user session gets 404 on the staff APIs and a redirect on the page",
      b.call("/staff/me")[0] == 404 and b.call("/staff/applications")[0] == 404 and (first_hop(b, "/staff")[1] or "").endswith("/staff/signin"))
check("visitors see the sign-in and set-up pages (neutral, no staff list)",
      C().raw("/staff/signin")[0] == 200 and "Back office" in C().raw("/staff/signin")[2] and C().raw("/staff/setup?token=x")[0] == 200)
# Lockout (HM-43, HM-45): keyed on address + connection, identical for staff and unknown addresses.
lk = staff_client(LOCK_EMAIL)
lasts = []
for addr in (LOCK_EMAIL, nobody):
    ipx, ipy = next_ip(), next_ip()
    seq = [C().call("/staff/auth/password", {"email": addr, "password": "wrong password " + str(i)}, ip=ipx)[0] for i in range(5)]
    last = C().call("/staff/auth/password", {"email": addr, "password": STAFF_PASSWORD}, ip=ipx)
    lasts.append(strip(last))
    other = C().call("/staff/auth/password", {"email": addr, "password": STAFF_PASSWORD}, ip=ipy)
    who = "staff" if addr == LOCK_EMAIL else "unknown"
    check(f"5 wrong passwords from one connection lock that connection for the address ({who}): 429 there",
          seq == [200] * 5 and last[0] == 429 and err(last) == "RATE_LIMITED", (seq, last[0]))
    check(f"…but not another connection ({who})", other[0] == 200, other[0])
check("…an identical 429 for both", lasts[0] == lasts[1], lasts)
before_l = len(mails_to(LOCK_EMAIL))
cy = C()
ipy = next_ip()
r = cy.call("/staff/auth/password", {"email": LOCK_EMAIL, "password": STAFF_PASSWORD}, ip=ipy)
r = cy.call("/staff/auth/verify", {"email": LOCK_EMAIL, "code": staff_code(LOCK_EMAIL, after=before_l)}, ip=ipy)
check("HM-43: a correct sign-in from another connection still works after someone else's wrong passwords", r[0] == 200, r)
# HM-43: someone else's wrong passwords and wrong codes can't burn a pending sign-in.
ca, cb = C(), C()
before_l = len(mails_to(LOCK_EMAIL))
ca.call("/staff/auth/password", {"email": LOCK_EMAIL, "password": STAFF_PASSWORD})
a_code = staff_code(LOCK_EMAIL, after=before_l)
ipb = next_ip()
for i in range(3):
    cb.call("/staff/auth/password", {"email": LOCK_EMAIL, "password": "nope nope nope " + str(i)}, ip=ipb)
b_codes = [cb.call("/staff/auth/verify", {"email": LOCK_EMAIL, "code": f"{100000 + i}"}, ip=ipb)[0] for i in range(5)]
nc = [C().call("/staff/auth/verify", {"email": LOCK_EMAIL, "code": f"{200000 + i}"})[0] for i in range(5)]
check("…browser B's wrong codes only touch B's own attempt (422s), a cookieless caller touches nothing", set(b_codes) <= {422, 429} and set(nc) == {422}, (b_codes, nc))
r = ca.call("/staff/auth/verify", {"email": LOCK_EMAIL, "code": a_code})
check("HM-43: browser A's code still works after 3 wrong passwords and 5 wrong codes from browser B", r[0] == 200, r)
# HM-45: concurrent guesses can't slip past the count.
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       values ({lit("clr" + RUN)}, 'staff.lockout_cleared', 'service', 'email_hash', {lit(email_key(nobody))}, 'clear', 'allowed', now())''')
ipc = next_ip()
with ThreadPoolExecutor(max_workers=10) as pool:
    conc = list(pool.map(lambda i: C().call("/staff/auth/password", {"email": nobody, "password": "concurrent guess " + str(i)}, ip=ipc)[0], range(10)))
check("HM-45: 10 concurrent wrong passwords from one connection: at most 5 are evaluated", sum(1 for x in conc if x != 429) <= 5 and conc.count(429) >= 5, sorted(conc))
# HM-43: the per-address ceiling (50 an hour) catches guessing spread over many connections.
ceil = f"e2e-ceil-{RUN}"
sql(f'''insert into "AuditEvent"(id, "eventType", "actorType", "resourceType", "resourceId", action, outcome, "occurredAt")
       select {lit(ceil)} || g, 'staff.pw_attempt_addr', 'service', 'email_hash', {lit(email_key(nobody))}, 'password', 'allowed', now() from generate_series(1, 50) g''')
r = C().call("/staff/auth/password", {"email": nobody, "password": STAFF_PASSWORD})
check("…50 attempts an hour on one address: the next is 429 from any connection", r[0] == 429 and strip(r) == lasts[0], r[0])
# HM-46: an over-long password is refused before any hashing.
before_rows = sql(f'''select count(*) from "AuthCode" where email = {lit(LOCK_EMAIL)} and scope = 'staff' ''')
t0 = time.time()
r = C().call("/staff/auth/password", {"email": LOCK_EMAIL, "password": "x" * 10240})
took = time.time() - t0
empty = C().call("/staff/auth/password", {"email": LOCK_EMAIL, "password": ""})
check("HM-46: a 10 kB password gets the same fast 422 as an empty one, and no code row",
      r[0] == 422 and strip(r) == strip(empty) and took < 0.4
      and sql(f'''select count(*) from "AuthCode" where email = {lit(LOCK_EMAIL)} and scope = 'staff' ''') == before_rows, f"{r[0]} {took:.3f}s")
# HM-47: staff addresses can't apply, and /join sends them nothing.
before_v = len(mails_to(VERIFIER_EMAIL))
rs = C().call("/applications/start", {"email": VERIFIER_EMAIL, "consent_privacy": True})
ru = C().call("/applications/start", {"email": f"beta-hm47-{RUN}@example.com", "consent_privacy": True})
time.sleep(1.5)
check("HM-47: /join step 1 for a staff address: the same 200, no email, a decoy code row",
      strip(rs) == strip(ru) and rs[0] == 200 and len(mails_to(VERIFIER_EMAIL)) == before_v
      and sql(f'''select count(*) from "AuthCode" where email = {lit(VERIFIER_EMAIL)} and scope is null and decoy = true''') != "0")
n_sessions = lambda: int(sql(f'''select count(*) from "Session" s join "User" u on u.id = s."userId" where u.email = {lit(LOCK_EMAIL)} and scope = 'staff' '''))
before_s = n_sessions()
r = lk.call("/staff/auth/logout", {})
check("sign-out ends this staff session (and only this one)", r[0] == 200 and lk.call("/staff/me")[0] == 404 and n_sessions() == before_s - 1
      and ca.call("/staff/me")[0] == 200, (before_s, n_sessions()))
check("staff-only accounts never appear in the product", sql(f'''select count(*) from "Profile" p join "User" u on u.id = p."userId" where u.email = {lit(LOCK_EMAIL)}''') == "0")

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
check("export includes the application, the activation invite and survey sends",
      (ex.get("application") or {}).get("status") == "approved" and ex.get("invites") and any(x["campaign"] == SURVEY["campaign"] for x in ex.get("surveyEmails", [])))
dru_c = start_application(dru)[0]
check("an applicant can export their data too", (d(dru_c.call("/me/export")).get("export", {}).get("application") or {}).get("status") == "draft")
r = dru_c.call("/me/delete", {})
check("an applicant can delete their application", r[0] == 200 and sql(f'select status from "Application" where id = {lit(application_id(dru))}') == "withdrawn"
      and sql(f'select "accountStatus" from "User" where email = {lit(dru)}') == "deletion_pending")
check("deletion requested", ada_c.call("/me/delete", {})[0] == 200)
check("deletion removes the address on invites", sql(f'select count(*) from "Invite" where email = {lit(ada)}') == "0"
      and sql(f'select count(*) from "Invite" where "usedByUserId" = {lit(ada_id)}') == "1")
check("feedback deleted with the account", sql(f'select count(*) from "TesterFeedback" where "userId" = {lit(ada_id)}') == "0")
before = len(mails_to(ada))
r = C().call("/auth/request-code", {"email": ada})
time.sleep(1.5)
check("a deleting account gets the identical sign-in answer and no email", r[0] == 200 and d(r) == {"status": "sent", "message": SIGNIN_MSG} and len(mails_to(ada)) == before)

print()
print(f"{fails} FAILED" if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
