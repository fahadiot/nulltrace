from nulltrace.core import *
from nulltrace.localuseragent import *


async def codecademy(email, client, out):
    name = "codecademy"
    domain = "codecademy.com"
    method = "register"
    frequent_rate_limit=True

    headers = {
        # the bundled Chrome UAs are too old: codecademy redirects them to /errors/browser
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en,en-US;q=0.5',
        'Referer': 'https://www.codecademy.com/register?redirect=%2',
        'Content-Type': 'application/json',
        'Origin': 'https://www.codecademy.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'TE': 'Trailers',
    }
    try:
        req = await client.get(
            "https://www.codecademy.com/register?redirect=%2F",
            headers=headers)
        soup = BeautifulSoup(req.content, features="html.parser")
        headers["X-CSRF-Token"] = soup.find(
            attrs={"name": "csrf-token"}).get("content")
    except Exception:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
        return None

    data = '{"user":{"email":"' + email + '"}}'

    try:
        response = await client.post(
            'https://www.codecademy.com/register/validate',
            headers=headers,
            data=data)
    except Exception:
        response = None
    if response is not None and response.status_code == 400 and 'already been taken' in response.text:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": False,
                    "exists": True,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    elif response is not None and response.status_code == 200:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": False,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    else:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
