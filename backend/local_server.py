# -*- coding: utf-8 -*-
"""本地联调服务器：python local_server.py 启动 http://127.0.0.1:9000
先设置环境变量 DASHSCOPE_API_KEY 再启动。"""
import os
from wsgiref.simple_server import make_server
from main import handler

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9000"))
    if not os.environ.get("DASHSCOPE_API_KEY"):
        print("[警告] 未检测到 DASHSCOPE_API_KEY 环境变量，请先设置后再启动。")
    httpd = make_server("127.0.0.1", port, handler)
    print(f"本地服务已启动: http://127.0.0.1:{port}")
    httpd.serve_forever()
