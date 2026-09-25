from nulltrace.core import *
from nulltrace.localuseragent import *


async def deezer(email, client, out):
    name = "deezer"
    domain = "deezer.com"
    method = "register"
    frequent_rate_limit = False

    headers = {
        'User-Agent': random.choice(ua["browsers"]["chrome"]),
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'Origin': 'https://www.deezer.com',
        'Referer': 'https://www.deezer.com/',
    }
    params = {
        'method': 'deezer.emailCheck',
        'api_version': '1.0',
        'api_token': '',
    }
    try:
        response = await client.post(
            'https://www.deezer.com/ajax/gw-light.php',
            headers=headers,
            params=params,
            json={'EMAIL': email})
        data = response.json()
        availability = data.get('results', {}).get('availability')
    except Exception:
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
        return None

    if availability is None:
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    elif availability is False:
        # email not available for registration -> already registered
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": False,
                    "exists": True,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    else:
        out.append({"name": name, "domain": domain, "method": method, "frequent_rate_limit": frequent_rate_limit,
                    "rateLimit": False,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
