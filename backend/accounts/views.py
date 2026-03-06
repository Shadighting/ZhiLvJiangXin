import json

from django.contrib.auth import authenticate, login, get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


def _add_cors_headers(response):
    response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type"
    return response


User = get_user_model()


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


@csrf_exempt
def api_register(request):
    if request.method == 'OPTIONS':
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

    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if not username or not password:
        resp = JsonResponse({'detail': '用户名和密码均为必填项'}, status=400)
        return _add_cors_headers(resp)

    if len(password) < 6:
        resp = JsonResponse({'detail': '密码长度至少为 6 位'}, status=400)
        return _add_cors_headers(resp)

    if User.objects.filter(username=username).exists():
        resp = JsonResponse({'detail': '用户名已存在，请更换一个'}, status=400)
        return _add_cors_headers(resp)

    user = User.objects.create_user(username=username, password=password)

    # 可选：注册后直接登录
    login(request, user)

    resp = JsonResponse({'detail': 'ok'})
    return _add_cors_headers(resp)
