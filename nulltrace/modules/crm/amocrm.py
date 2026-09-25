from nulltrace.core import *
from nulltrace.localuseragent import *


async def amocrm(email, client, out):
    name = "amocrm"
    domain = "amocrm.com"
    method= "register"
    frequent_rate_limit=False

    headers = {
        'Connection': 'keep-alive',
        'Accept': '*/*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': random.choice(ua["browsers"]["chrome"]),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://www.kommo.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://www.kommo.com/',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    }

    data = {
      'LOGIN': email
    }

    # amocrm.com now 301-redirects to kommo.com (which turns the POST into a GET)
    try:
        response = await client.post('https://www.kommo.com/account/check_login.php', headers=headers, data=data)
        status = response.json().get("status") if response.status_code == 200 else None
    except Exception:
        status = None
    if status=="used":
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": False,
                    "exists": True,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    elif status=="free":
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": False,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    else :
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": True,
                    "exists": False,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    return()
