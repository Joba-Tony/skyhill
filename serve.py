#!/usr/bin/env python3
# 开发用静态服务器：禁用缓存，避免浏览器用旧的 JS/资源。
# 用法：python3 serve.py [端口]  (默认 8080)，然后打开 http://localhost:8080
import http.server, socketserver, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'天空之山 · 开发服务器（禁缓存）→ http://localhost:{PORT}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
