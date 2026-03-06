"""
Minimal Kokoro TTS server — no FastAPI, uses Python stdlib http.server.
Exposes /v1/audio/speech compatible with Clarion's proxy.

Run: /tmp/kokoro-env12/bin/python3.12 kokoro-server.py
     → http://localhost:8880
"""

import io
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler

_kokoro = None

def get_kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        print('[kokoro] Loading model...')
        _kokoro = Kokoro('kokoro-v1.0.int8.onnx', 'voices-v1.0.bin')
        print('[kokoro] Model ready')
    return _kokoro

class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'[kokoro] {fmt % args}')

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path == '/health':
            self.send_json(200, {'status': 'ok'})
        else:
            self.send_json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/v1/audio/speech':
            self.send_json(404, {'error': 'not found'})
            return

        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))

        text  = body.get('input', '')
        voice = body.get('voice', 'af_heart')
        speed = float(body.get('speed', 1.0))

        if not text:
            self.send_json(400, {'error': 'input required'})
            return

        try:
            import soundfile as sf
            kokoro = get_kokoro()
            samples, rate = kokoro.create(text, voice=voice, speed=speed, lang='en-us')

            buf = io.BytesIO()
            sf.write(buf, samples, rate, format='mp3')
            data = buf.getvalue()

            self.send_response(200)
            self.send_header('Content-Type', 'audio/mpeg')
            self.send_header('Content-Length', len(data))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)

        except Exception as e:
            print(f'[kokoro] Error: {e}')
            self.send_json(500, {'error': str(e)})

if __name__ == '__main__':
    # Eager-load the model at startup so the first request doesn't stall
    get_kokoro()

    host = os.environ.get('KOKORO_HOST', '127.0.0.1')
    port = int(os.environ.get('KOKORO_PORT', '8880'))
    server = HTTPServer((host, port), Handler)
    print(f'[kokoro] Starting on http://{host}:{port}')
    server.serve_forever()
