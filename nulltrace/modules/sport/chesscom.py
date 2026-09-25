from nulltrace.core import *
from nulltrace.localuseragent import *


async def chesscom(email, client, out):
    name = "chesscom"
    domain = "chess.com"
    method = "register"
    frequent_rate_limit = False

    headers = {
        'User-Agent': random.choice(ua["browsers"]["chrome"]),
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.chess.com/register',
        'X-Requested-With': 'XMLHttpRequest',
    }

    try:
        response = await client.get(
            'https://www.chess.com/callback/email/available',
            params={'email': email},
            headers=headers,
        )
    except Exception:
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
        return None

    try:
        data = response.json()
        available = data.get("isEmailAvailable")
        reason = str(data.get("reason", ""))
    except Exception:
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
        return None

    if available is False and "In Use" in reason:
        # email already registered to an account
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": False,
                    "exists": True,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    elif available is True:
        # email free -> not registered
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": False,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    else:
        # banned domain / captcha / unexpected -> no reliable signal
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
