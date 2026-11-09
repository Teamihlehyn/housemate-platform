"""End-to-end checks for the private housemate gender preference.

Usage:
  python3 tests/e2e_gender.py http://localhost:3000 "postgresql://<you>@localhost:5432/housemate_db"

Needs a research-mode server (APP_ENV=research) and a psql connection string for the
same database: gender is deliberately absent from every API response, so the test
reads it from the DB to prove who was matched.
"""
import datetime, http.cookiejar, json, subprocess, sys, urllib.error, urllib.request

BASE, PSQL = sys.argv[1], sys.argv[2]
fails = 0


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


def genders(ids):
    if not ids:
        return []
    q = 'select gender from "Search" where "userId" in (' + ",".join(f"'{i}'" for i in ids) + ")"
    return subprocess.check_output(["psql", PSQL, "-tAc", q], text=True).split()


d = lambda r: r[1].get("data") or {}
today = datetime.date.today()

print("== Women-only persona (Hana) ==")
h = C()
h.call("/auth/demo-persona", {"persona": "hana", "accept_privacy": True})
check("Hana's saved preference is women only", d(h.call("/me"))["search"]["genderPreference"] == ["woman"])
hh = d(h.call("/households/current"))["household"]
check("her household partner is a woman", genders([m["userId"] for m in hh["members"] if m["isSample"]]) == ["woman"])

print("== Open-to-anyone persona (Ben) ==")
b = C()
b.call("/auth/demo-persona", {"persona": "ben", "accept_privacy": True})
g = genders([c["userId"] for c in d(b.call("/recommendations"))["candidates"]])
check("Ben sees a mix of genders", len(set(g)) >= 2, sorted(set(g)))

print("== Email sign-up: woman, open to women only ==")
e = C()
email = f"g{datetime.datetime.now().strftime('%H%M%S%f')}@example.com"
code = d(e.call("/auth/request-code", {"email": email}))["sink_code"]
e.call("/auth/verify-code", {"email": email, "code": code, "accept_privacy": True})
e.call("/me/profile", {"journey": "find_together", "displayName": "Test Woman", "bio": "Testing the gender preference flow with a bio comfortably over the eighty character minimum."}, method="PATCH")
e.call("/me/search", {"cityId": "london", "areaIds": ["hackney"], "rentPeriod": "month", "rentMinMinor": 80000, "rentMaxMinor": 120000,
                      "moveMode": "range", "earliestDate": (today + datetime.timedelta(days=20)).isoformat(),
                      "latestDate": (today + datetime.timedelta(days=50)).isoformat(), "stayMinMonths": 6, "stayMaxMonths": 12}, method="PATCH")
check("gender + preference saved", e.call("/me/search", {"gender": "woman", "genderPreference": ["woman"]}, method="PATCH")[0] == 200)
habits = {"cleaning": "weekly", "quiet": "before_00", "guests": "never", "smoking": "no", "pets": "none", "social": "balanced"}
e.call("/me/search", {"preferences": [{"dimension": k, "ownAnswer": v, "acceptedValues": [v]} for k, v in habits.items()]}, method="PATCH")
e.call("/me/search/publish", {})
recs = d(e.call("/recommendations"))["candidates"]
g = genders([c["userId"] for c in recs])
check("only women shown", len(recs) >= 3 and set(g) == {"woman"}, f"{len(recs)}: {sorted(set(g))}")
woman = recs[0]["userId"]

print("== Changing the preference ==")
e.call("/me/search", {"genderPreference": ["man"]}, method="PATCH")
recs2 = d(e.call("/recommendations"))["candidates"]
g2 = genders([c["userId"] for c in recs2])
check("now only men shown (world tops up)", len(recs2) >= 3 and set(g2) == {"man"}, f"{len(recs2)}: {sorted(set(g2))}")
check("can't introduce outside your preference", e.call("/introductions", {"target_user_id": woman, "text": "Hi! Trying to reach someone outside my preference now."})[0] == 404)
check("can introduce within your preference", e.call("/introductions", {"target_user_id": recs2[0]["userId"], "text": "Hi! Our dates and areas line up — want to look for a place?"})[0] == 200)

print("== Privacy & validation ==")
check("gender never in a public profile", "gender" not in json.dumps(d(e.call(f"/users/{recs2[0]['userId']}"))).lower())
fe = lambda r: (r[1].get("error") or {}).get("field_errors") or {}
check("empty preference rejected", "genderPreference" in fe(e.call("/me/search", {"genderPreference": []}, method="PATCH")))
check("unknown gender rejected", "gender" in fe(e.call("/me/search", {"gender": "robot"}, method="PATCH")))
e.call("/me/search", {"gender": "prefer_not_to_say", "genderPreference": ["woman", "man", "non_binary"]}, method="PATCH")
check("'prefer not to say' still matched by people open to anyone", len(d(e.call("/recommendations"))["candidates"]) >= 3)

print(f"\n{'ALL PASSED' if fails == 0 else f'{fails} FAILED'}")
sys.exit(1 if fails else 0)
