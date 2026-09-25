from nulltrace.core import *
from nulltrace.localuseragent import *


async def hubspot(email, client, out):
    name = "hubspot"
    domain = "hubspot.com"
    method= "login"
    frequent_rate_limit=False


    headers = {
        'authority': 'api.hubspot.com',
        'User-Agent': random.choice(ua["browsers"]["chrome"]),
        'content-type': 'application/json',
        'origin': 'https://app.hubspot.com',
        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'referer': 'https://app.hubspot.com/',
        'accept-language': 'en-US;q=0.8,en;q=0.7',
    }

    data = '{"email":"'+email+'","password":"","rememberLogin":false}'

    response = await client.post('https://api.hubspot.com/login-api/v1/login', headers=headers, data=data)
    try:
        status = response.json().get("status")
    except Exception:
        status = None
    # INVALID_PASSWORD (400) and the 403 password-invalidated states are only
    # returned for existing users; unknown addresses get 400 INVALID_USER.
    if status in ("INVALID_PASSWORD", "PASSWORD_DEPRECATED", "SUSPICIOUS_ACTIVITY"):
        exists, rate_limit = True, False
    elif status == "INVALID_USER":
        exists, rate_limit = False, False
    else:
        exists, rate_limit = False, True
    out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                "rateLimit": rate_limit,
                "exists": exists,
                "emailrecovery": None,
                "phoneNumber": None,
                "others": None})
    return()
