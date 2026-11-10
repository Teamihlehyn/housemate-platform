"""End-to-end check of the user-testing (research-mode) journeys against a running Housemate.

Usage:
  python3 tests/e2e_research.py http://localhost:3000
  ADMIN_TEST_EMAIL=you@example.com python3 tests/e2e_research.py https://gethousemate.vercel.app

The server must run with APP_ENV=research (and NEXT_PUBLIC_APP_ENV=research).
ADMIN_TEST_EMAIL (optional) must be listed in that server's ADMIN_EMAILS; the check
asserts admins never get an on-screen code. On a server with Resend configured that
sends a real email to the address, so only use your own.

Creates test accounts (emails demo-ben-*, demo-zainab-*, tester*@example.com). On a
shared database, delete them afterwards — see CLAUDE.md → "Cleaning up after a prod e2e".
"""
import datetime, http.cookiejar, json, os, sys, urllib.error, urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
fails = 0


class Client:
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


d = lambda r: r[1].get("data") or {}
err = lambda r: (r[1].get("error") or {}).get("code")
today = datetime.date.today()

print("== Persona path (Ben, London) — research tasks 2–5 solo ==")
a = Client()
check("persona requires consent", err(a.call("/auth/demo-persona", {"persona": "ben", "accept_privacy": False})) == "CONSENT_REQUIRED")
r = a.call("/auth/demo-persona", {"persona": "ben", "accept_privacy": True})
check("persona signs in", r[0] == 200 and d(r).get("next") == "/discover", r[0])
recs = d(a.call("/recommendations"))["candidates"]
check("sample housemates match the persona", len(recs) >= 3, f"{len(recs)} matches")
top = recs[0]
check("introduction sent", a.call("/introductions", {"target_user_id": top["userId"], "text": "Hi! Our dates and areas line up — want to look for a place together?"})[0] == 200)
intro = d(a.call("/introductions?direction=outgoing"))["introductions"][0]
convo = intro["conversationId"]
check("sample housemate auto-accepts", intro["state"] == "accepted" and convo, intro["state"])
a.call(f"/conversations/{convo}/messages", {"client_message_id": "t1", "body": "Hi there, sounds great!"})
msgs = d(a.call(f"/conversations/{convo}/messages"))["messages"]
check("sample housemate greets and replies", len(msgs) >= 3 and not msgs[-1]["mine"], f"{len(msgs)} messages")
check("household forms immediately", d(a.call("/households", {"introduction_id": intro["id"], "plan": {}})).get("state") == "active")
hh = d(a.call("/households/current"))["household"]
plan = hh["currentPlan"]
check("plan v1 agreed by both", plan["agreed"] and plan["versionNo"] == 1)
check("contributions stored monthly (GBP)", all(500_00 <= v <= 2000_00 for v in plan["contributions"].values()), plan["contributions"])
ids = [m["userId"] for m in hh["members"]]
r = a.call(f"/households/{hh['id']}/plan", {"expected_plan_version": 1, "contributions": {ids[0]: 100000, ids[1]: 90000},
           "noticePeriodWeeks": 8, "billsSplit": "same_as_rent", "notes": "Rent paid by the 1st."}, method="PATCH")
check("agreement edit saved as v2", d(r).get("planVersion") == 2, r[1])
plan = d(a.call("/households/current"))["household"]["currentPlan"]
check("sample housemate accepts v2", plan["agreed"] and plan["noticePeriodWeeks"] == 8 and plan["billsSplit"] == "same_as_rent")
check("stale edit rejected", err(a.call(f"/households/{hh['id']}/plan", {"expected_plan_version": 1, "noticePeriodWeeks": 4}, method="PATCH")) == "VERSION_CONFLICT")
props = d(a.call("/properties"))["properties"]
a.call(f"/households/{hh['id']}/shortlist", {"source_property_id": props[0]["id"]})
item = d(a.call("/households/current"))["household"]["shortlist"][0]
check("both interested after adding", item["bothInterested"])
start = (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat() + "Z"
r = a.call(f"/households/{hh['id']}/viewings", {"shortlist_item_id": item["id"], "starts_at": start, "timezone": "Europe/London"})
check("viewing confirmed by sample housemate", d(r).get("state") == "confirmed", d(r))
check("viewing completed by both", d(a.call(f"/viewings/{d(r).get('id')}", {"action": "outcome", "response": "completed"})).get("state") == "completed")
hid = d(a.call(f"/households/{hh['id']}/handoffs", {"remote_review_ack": True})).get("id")
check("application accepted after both consent", d(a.call(f"/handoffs/{hid}", {"action": "consent"})).get("state") == "accepted")
r = a.call(f"/households/{hh['id']}/move-in", {"actual_date": today.isoformat(), "response": "moved_in"})
check("move-in completes the household", d(r).get("householdState") == "completed", d(r))

print("== Report & feedback ==")
r = a.call("/reports", {"target_user_id": top["userId"], "category": "other", "description": "Testing the report flow end to end."})
check("report creates a case", r[0] == 200 and d(r).get("caseId"), d(r))
check("feedback stored", a.call("/feedback", {"message": "e2e feedback check", "rating": 3, "page": "/household", "tester_id": "T-E2E", "source": "test"})[0] == 200)

print("== Isolation between testers ==")
b = Client()
b.call("/auth/demo-persona", {"persona": "ben", "accept_privacy": True})
recs_b = d(b.call("/recommendations"))["candidates"]
check("second Ben sees only their own sample housemates", not ({c["userId"] for c in recs_b} & {c["userId"] for c in recs}))
check("other world's profile is not visible", b.call(f"/users/{top['userId']}")[0] == 404)
check("no introductions across worlds", b.call("/introductions", {"target_user_id": top["userId"], "text": "Trying to reach someone in another tester's world here."})[0] == 404)

print("== ENG-04: research keeps its labelled score; HM-04: plan property is validated ==")
prof = d(b.call(f"/users/{recs_b[0]['userId']}"))
check("research profile still has a numeric score and the checks list",
      isinstance(prof.get("credibility", {}).get("score"), int) and isinstance(prof["credibility"].get("checks"), list))
check("research candidates still carry a score", all(isinstance(c.get("score"), int) for c in recs_b))
b.call("/introductions", {"target_user_id": recs_b[0]["userId"], "text": "Hi! Our dates and areas line up — want to look for a place together?"})
intro_b = d(b.call("/introductions?direction=outgoing"))["introductions"][0]
r = b.call("/households", {"introduction_id": intro_b["id"], "plan": {"propertyId": "not-a-real-home"}})
check("unknown plan.propertyId is rejected (422)", r[0] == 422 and err(r) == "VALIDATION", f"{r[0]} {err(r)}")
r = b.call("/households", {"introduction_id": intro_b["id"], "plan": {"propertyId": props[0]["id"]}})
check("a real sample home is accepted", r[0] == 200, r[1].get("error"))
check("and shows on the plan", (d(b.call("/households/current"))["household"]["currentPlan"] or {}).get("propertyId") == props[0]["id"])

print("== In-progress persona (Zainab, Lagos) ==")
z = Client()
check("lands on household", d(z.call("/auth/demo-persona", {"persona": "zainab", "accept_privacy": True})).get("next") == "/household")
hz = d(z.call("/households/current"))["household"]
check("household active with agreed plan", hz["state"] == "active" and hz["currentPlan"]["agreed"])
c = list(hz["currentPlan"]["contributions"].values())
check("Lagos contributions monthly, not annual", all(v < 30_000_000 for v in c) and hz["currentPlan"]["currency"] == "NGN", c)
check("a sample home is pre-shortlisted", len(hz["shortlist"]) == 1)

print("== Email path with on-screen code ==")
e = Client()
email = f"tester{datetime.datetime.now().strftime('%H%M%S%f')}@example.com"
code = d(e.call("/auth/request-code", {"email": email})).get("sink_code")
check("code shown on screen", bool(code))
check("consent required before sign-in", err(e.call("/auth/verify-code", {"email": email, "code": code})) == "CONSENT_REQUIRED")
r = e.call("/auth/verify-code", {"email": email, "code": code, "accept_privacy": True})
check("code still valid after consent prompt; signs in", d(r).get("is_new") is True, r[1].get("error"))
e.call("/me/profile", {"journey": "find_together", "displayName": "Test Person", "bio": "Testing the onboarding flow with a bio long enough to pass the eighty character minimum rule."}, method="PATCH")
e.call("/me/search", {"cityId": "lagos", "areaIds": ["yaba"], "rentPeriod": "year", "rentMinMinor": 100000000, "rentMaxMinor": 200000000,
                      "moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(),
                      "latestDate": (today + datetime.timedelta(days=50)).isoformat(), "stayMinMonths": 12, "stayMaxMonths": 24}, method="PATCH")
strict = {"cleaning": "weekly", "quiet": "before_00", "guests": "never", "smoking": "no", "pets": "none", "social": "balanced"}
e.call("/me/search", {"gender": "woman", "preferences": [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in strict.items()]}, method="PATCH")
r = e.call("/me/search/publish", {})
check("publish ok", r[0] == 200, r[1].get("error"))
check("email sign-up gets matching sample housemates (strict habits)", len(d(e.call("/recommendations"))["candidates"]) >= 3)

admin = os.environ.get("ADMIN_TEST_EMAIL")
print("== Staff protection ==")
if admin:
    r = Client().call("/auth/request-code", {"email": admin})
    check("admin email never gets an on-screen code", not d(r).get("sink_code"), f"{r[0]} {err(r)}")
else:
    print("  SKIP admin on-screen-code check (set ADMIN_TEST_EMAIL to an address in the server's ADMIN_EMAILS)")

print(f"\n{'ALL PASSED' if fails == 0 else f'{fails} FAILED'}")
sys.exit(1 if fails else 0)
