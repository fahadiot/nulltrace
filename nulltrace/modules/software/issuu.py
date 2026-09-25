from nulltrace.core import *
from nulltrace.localuseragent import *
import json


async def issuu(email, client, out):
    name = "issuu"
    domain = "issuu.com"
    method = "register"
    frequent_rate_limit=False

    headers = {
        'User-Agent': random.choice(ua["browsers"]["firefox"]),
        'Accept': '*/*',
        'Accept-Language': 'en,en-US;q=0.5',
        'Referer': 'https://issuu.com/signup',
        'x-trpc-source': 'nextjs-react',
        'Cache-Control': 'no-cache',
        'DNT': '1',
        'Connection': 'keep-alive',
        'TE': 'Trailers',
    }

    # the old /call/signup/check-email endpoint is gone; the signup page now uses this tRPC procedure
    try:
        response = await client.get(
            'https://issuu.com/api/user-service/public.user.auth.checkEmailAvailability',
            params={'input': json.dumps({'json': {'email': email}})},
            headers=headers)
        available = response.json()["result"]["data"]["json"]["isEmailAvailable"]
        if available is False:
            out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                        "rateLimit": False,
                        "exists": True,
                        "emailrecovery": None,
                        "phoneNumber": None,
                        "others": None})
        elif available is True:
            out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                        "rateLimit": False,
                        "exists": False,
                        "emailrecovery": None,
                        "phoneNumber": None,
                        "others": None})
        else:
            raise ValueError(available)
    except Exception:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
