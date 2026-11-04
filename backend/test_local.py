# -*- coding: utf-8 -*-
"""一次性后端联调测试：读取测试图 -> 调 analyze_pet -> 打印结果"""
import base64
import json
import sys

sys.path.insert(0, ".")
from main import analyze_pet

img_path = "../test/一只可爱的橘猫正面照_圆脸大眼睛_表情呆萌_居家温馨背景_宠_2026-11-04T14-47-03.png"
with open(img_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")

result = analyze_pet(b64, "豆包", "猫咪", "呆萌贪吃")
print(json.dumps(result, ensure_ascii=False, indent=2))
