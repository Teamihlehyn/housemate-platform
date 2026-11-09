"""End-to-end checks for beta mode (ENG-01, ENG-02, ENG-06). The start of ENG-10's suite.

Usage:
  python3 tests/e2e_beta.py http://localhost:3100 "postgresql://<you>@localhost:5432/<beta_test_db>"

Needs a LOCAL beta-mode server (APP_ENV=beta, NEXT_PUBLIC_APP_ENV=beta, no RESEND_API_KEY)
and a psql connection string for the same database. Beta emails login codes, so the
test writes its own codes into "AuthCode" and plays the staff reviewer by updating
"VerificationCheck" directly. Never point this at a shared or cloud database.
"""
import datetime, http.cookiejar, json, subprocess, sys, urllib.error, urllib.request, uuid

BASE, PSQL = sys.argv[1], sys.argv[2]
if "neon.tech" in PSQL or "localhost" not in PSQL:
    sys.exit("Refusing to run: e2e_beta.py writes directly to the database; use a local one.")
fails = 0
RUN = datetime.datetime.now().strftime("%H%M%S%f")
today = datetime.date.today()


class C:
    def __init__(self):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(self, path, body=None, method=None):
        req = urllib.request.Request(
            BASE + "/api/v1" + path,
            data=json.dumps(body).encode() if body is not None else None,
            method=method or ("POST" if body is not None else "GET"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with self.op.open(req, timeout=60) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode())
            except Exception:
                return e.code, {}


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
    sql(f'insert into "AuthCode"(id, email, code, "expiresAt") values ({lit(uuid.uuid4().hex)}, {lit(email)}, {lit(code)}, now() + interval \'10 minutes\')')
    return code


def user_id(email):
    return sql(f'select id from "User" where email = {lit(email)}')


def set_identity(uid, status):
    sql(f'update "VerificationCheck" set status = {lit(status)} where "userId" = {lit(uid)} and category = \'identity\'')


d = lambda r: r[1].get("data") or {}
err = lambda r: (r[1].get("error") or {}).get("code")


def member(name, area):
    c, email = C(), f"beta-{name}-{RUN}@example.com"
    r = c.call("/auth/verify-code", {"email": email, "code": new_code(email), "accept_privacy": True})
    assert r[0] == 200, r
    c.call("/me/profile", {"journey": "find_together", "displayName": name.title(),
                           "bio": "Beta end-to-end test member with a bio comfortably over the eighty character minimum."}, method="PATCH")
    c.call("/me/search", {"cityId": "london", "areaIds": [area], "rentPeriod": "month", "rentMinMinor": 80000, "rentMaxMinor": 120000,
                          "moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(),
                          "latestDate": (today + datetime.timedelta(days=50)).isoformat(), "stayMinMonths": 6, "stayMaxMonths": 12}, method="PATCH")
    habits = {"cleaning": "weekly", "quiet": "before_00", "guests": "up_to_2_nights", "smoking": "no", "pets": "none", "social": "balanced"}
    c.call("/me/search", {"gender": "prefer_not_to_say",
                          "preferences": [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in habits.items()]}, method="PATCH")
    r = c.call("/me/search/publish", {})
    assert r[0] == 200, r
    return c, email, user_id(email)


print("== Beta mode is on ==")
r = C().call("/auth/request-code", {"email": f"beta-probe-{RUN}@example.com"})
check("no on-screen code in beta", not d(r).get("sink_code"), f"{r[0]} {err(r)}")
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

print()
print(f"{fails} FAILED" if fails else "ALL PASSED")
sys.exit(1 if fails else 0)
