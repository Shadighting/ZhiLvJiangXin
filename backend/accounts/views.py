import json

from django.contrib.auth import authenticate, login
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


def _add_cors_headers(response):
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@csrf_exempt
def api_login(request):
    if request.method == 'OPTIONS':
        # 预检请求，直接返回允许信息
        resp = JsonResponse({'detail': 'ok'})
        return _add_cors_headers(resp)

    if request.method != 'POST':
        resp = JsonResponse({'detail': 'Method not allowed'}, status=405)
        return _add_cors_headers(resp)

    try:
        data = json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        resp = JsonResponse({'detail': 'Invalid JSON'}, status=400)
        return _add_cors_headers(resp)

    username = data.get('username')
    password = data.get('password')

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        resp = JsonResponse({'detail': 'ok'})
        return _add_cors_headers(resp)

    resp = JsonResponse({'detail': '用户名或密码错误'}, status=400)
    return _add_cors_headers(resp)
