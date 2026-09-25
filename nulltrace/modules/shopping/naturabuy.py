from nulltrace.core import *
from nulltrace.localuseragent import *


async def naturabuy(email, client, out):
    name = "naturabuy"
    domain = "naturabuy.fr"
    method = "register"
    frequent_rate_limit=False

    headers = {
        'User-Agent': random.choice(ua["browsers"]["chrome"]),
        'Accept': '*/*',
        'Accept-Language': 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
        'Origin': 'https://www.naturabuy.fr',
        'Referer': 'https://www.naturabuy.fr/register.php',
    }

    try:
        # the uniqueness check needs the per-session "guard" value of the register form
        page = await client.get('https://www.naturabuy.fr/register.php', headers=headers)
        guard = re.search(r'name="guard" value="([^"]+)"', page.text).group(1)
        headers['X-Requested-With'] = 'XMLHttpRequest'
        data = {
            'action': 'checkValue',
            'jsref': 'email',
            'jsvalue': email,
            'registerMode': 'full',
            'guard': guard,
        }
        # the endpoint expects multipart/form-data (FormData in the browser)
        response = await client.post('https://www.naturabuy.fr/ajax/front/register/Register.php',
                                     headers=headers, data=data, files={'_': (None, '')})
        free = response.json()["free"]
    except Exception:
        free = None

    if free is False:
        out.append({"name": name,"domain":domain,"method":method,"frequent_rate_limit":frequent_rate_limit,
                    "rateLimit": False,
                    "exists": True,
                    "emailrecovery": None,
                    "phoneNumber": None,
                    "others": None})
    elif free is True:
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
