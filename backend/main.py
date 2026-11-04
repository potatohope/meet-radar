# -*- coding: utf-8 -*-
"""
遇见雷达 · 宠物人格测评 后端函数（阿里云函数计算 FC）
- 纯标准库实现，无第三方依赖，部署最稳
- 接收宠物照片 + 信息，调用百炼 qwen3-vl-plus 生成人格测评 JSON
- API Key 通过环境变量 DASHSCOPE_API_KEY 注入，绝不写死在代码/前端
"""
import json
import os
import base64
import urllib.request

DASHSCOPE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
MODEL = os.environ.get("MODEL", "qwen3-vl-plus")
API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")

CORS_HEADERS = [
    ("Content-Type", "application/json; charset=utf-8"),
    ("Access-Control-Allow-Origin", "*"),
    ("Access-Control-Allow-Methods", "GET, POST, OPTIONS"),
    ("Access-Control-Allow-Headers", "Content-Type"),
]

PERSONALITY_TYPES = [
    "高冷霸总型",
    "治愈小太阳型",
    "古灵精怪型",
    "沉稳老干部型",
    "软萌黏人精型",
    "活力小马达型",
]

SYSTEM_PROMPT = (
    "你是一位专业又幽默的宠物人格测评师，擅长通过观察宠物的外貌、毛色、表情、眼神与神态，"
    "推断它的\"隐藏人格\"。你的测评结果必须：1）正向、讨喜、让主人看完开心想分享；"
    "2）生动具体，像真的懂这只宠物；3）用中文，口语化、有梗；4）严格按指定 JSON 输出。"
)


def build_user_prompt(name, species, adjective):
    adj = (adjective or "").strip() or "未填写"
    return (
        "请分析这张宠物照片，结合主人提供的信息，生成它的隐藏人格测评。\n"
        f"宠物名字：{name}\n"
        f"物种：{species}\n"
        f"主人对它的一个形容：{adj}\n\n"
        "任务：\n"
        "1. 观察照片里宠物的物种、毛色、表情、神态、体型、眼神，推测它的性格。\n"
        f"2. 从以下 6 种人格类型中选最贴合的一种：{' / '.join(PERSONALITY_TYPES)}。\n"
        "3. 只输出一个 JSON 对象，不要输出任何解释、不要 markdown 代码块。字段如下：\n"
        "{\n"
        '  "type": "人格类型名",\n'
        '  "emoji": "对应emoji",\n'
        '  "tagline": "一句话人设，12字以内",\n'
        '  "scores": {"亲密度":0,"活力值":0,"傲娇度":0,"聪明值":0,"贪吃度":0,"独立度":0},\n'
        '  "comments": ["评语1","评语2","评语3"],\n'
        '  "pastLife": "前世身份，一句俏皮话",\n'
        '  "advice": "相处建议，2到3句话",\n'
        '  "monologue": "以宠物第一人称写的俏皮独白，1到2句话",\n'
        '  "summary": "80字以内的整体总结，温暖有爱"\n'
        "}\n"
        "要求：scores 是 0-100 的整数，且要与所选人格类型特征匹配；"
        "comments 每条 20 字以内，共 3 条；所有内容正向、可爱、讨喜。"
    )


def analyze_pet(photo_base64, name, species, adjective):
    """调用百炼 qwen3-vl-plus，返回结构化结果 dict。"""
    if not API_KEY:
        raise RuntimeError("缺少 DASHSCOPE_API_KEY 环境变量")

    # 兼容前端可能传来的完整 data URI
    if isinstance(photo_base64, str) and photo_base64.startswith("data:"):
        photo_base64 = photo_base64.split(",", 1)[1]

    payload = {
        "model": MODEL,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/jpeg;base64," + photo_base64
                        },
                    },
                    {
                        "type": "text",
                        "text": build_user_prompt(name, species, adjective),
                    },
                ],
            },
        ],
    }

    req = urllib.request.Request(
        DASHSCOPE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = json.loads(resp.read().decode("utf-8"))

    content = raw["choices"][0]["message"]["content"]
    content = content.strip()
    # 容错：万一模型包了代码块，剥掉
    if content.startswith("```"):
        content = content.strip("`")
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    result = json.loads(content)
    _normalize(result)
    return result


def _normalize(result):
    """兜底：保证 scores 为 0-100 整数、字段齐全。"""
    required = ["type", "emoji", "tagline", "scores", "comments",
                "pastLife", "advice", "monologue", "summary"]
    for k in required:
        result.setdefault(k, "" if k not in ("scores", "comments") else ({} if k == "scores" else []))
    dims = ["亲密度", "活力值", "傲娇度", "聪明值", "贪吃度", "独立度"]
    scores = result.get("scores") or {}
    for d in dims:
        try:
            scores[d] = int(scores.get(d, 50))
        except (TypeError, ValueError):
            scores[d] = 50
        scores[d] = max(0, min(100, scores[d]))
    result["scores"] = scores
    if not isinstance(result.get("comments"), list):
        result["comments"] = []
    result["comments"] = [str(c) for c in result["comments"]][:3]
    return result


def _json_response(status, body, start_response):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = CORS_HEADERS + [("Content-Length", str(len(data)))]
    start_response(status, headers)
    return [data]


def handler(environ, start_response):
    """FC HTTP 触发器（WSGI 风格）入口。"""
    method = environ.get("REQUEST_METHOD", "GET")

    if method == "OPTIONS":
        start_response("200 OK", CORS_HEADERS)
        return [b""]

    if method != "POST":
        return _json_response(
            "405 Method Not Allowed",
            {"ok": False, "error": "only POST allowed"},
            start_response,
        )

    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
        body = environ["wsgi.input"].read(length) if length else b""
        data = json.loads(body.decode("utf-8"))

        photo = data.get("photo", "")
        name = (data.get("name") or "").strip() or "毛孩子"
        species = (data.get("species") or "").strip() or "宠物"
        adjective = (data.get("adjective") or "").strip()

        if not photo:
            return _json_response(
                "400 Bad Request",
                {"ok": False, "error": "缺少照片 photo 字段"},
                start_response,
            )

        result = analyze_pet(photo, name, species, adjective)
        return _json_response("200 OK", {"ok": True, "result": result}, start_response)

    except json.JSONDecodeError:
        return _json_response(
            "400 Bad Request", {"ok": False, "error": "请求体不是合法 JSON"}, start_response
        )
    except RuntimeError as e:
        return _json_response("500 Internal Server Error", {"ok": False, "error": str(e)}, start_response)
    except Exception as e:  # noqa: BLE001
        return _json_response(
            "500 Internal Server Error", {"ok": False, "error": "测评失败：" + str(e)}, start_response
        )
