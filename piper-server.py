"""
Minimal Piper TTS server — Python stdlib http.server.
Wraps the piper CLI and exposes /v1/audio/speech compatible with Clarion's proxy.

Requirements:
  Install piper: https://github.com/rhasspy/piper/releases
  Download voice models from: https://huggingface.co/rhasspy/piper-voices

  Place .onnx and .onnx.json files in a directory (default: ./piper-models/)
  Example:
    mkdir piper-models
    wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
    wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json

Run: python3 piper-server.py
     → http://localhost:5000
"""

import json
import os
import subprocess
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

MODELS_DIR = os.environ.get('PIPER_MODELS', './piper-models')

VOICE_MAP = {
    'amy':         'en_US-amy-medium',
    'kathleen':    'en_US-kathleen-low',
    'lessac':      'en_US-lessac-medium',
    'ryan':        'en_US-ryan-medium',
    'alan':        'en_GB-alan-medium',
    'jenny_dioco': 'en_GB-jenny_dioco-medium',
}

DEFAULT_VOICE = 'amy'


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'[piper] {fmt % args}')

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

        text = body.get('input', '')
        voice_id = body.get('voice', DEFAULT_VOICE)

        if not text:
            self.send_json(400, {'error': 'input required'})
            return

        model_name = VOICE_MAP.get(voice_id, VOICE_MAP[DEFAULT_VOICE])
        model_path = Path(MODELS_DIR) / f'{model_name}.onnx'

        if not model_path.exists():
            self.send_json(404, {
                'error': f'Model not found: {model_path}. '
                         f'Download from https://huggingface.co/rhasspy/piper-voices'
            })
            return

        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp_path = tmp.name

            subprocess.run(
                ['piper', '--model', str(model_path), '--output_file', tmp_path],
                input=text.encode(),
                capture_output=True,
                check=True
            )

            with open(tmp_path, 'rb') as f:
                data = f.read()

            self.send_response(200)
            self.send_header('Content-Type', 'audio/wav')
            self.send_header('Content-Length', len(data))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(data)

        except subprocess.CalledProcessError as e:
            err = e.stderr.decode() if e.stderr else 'unknown error'
            print(f'[piper] Error: {err}')
            self.send_json(500, {'error': f'Piper failed: {err}'})
        except FileNotFoundError:
            self.send_json(500, {
                'error': 'piper binary not found. '
                         'Install from https://github.com/rhasspy/piper/releases'
            })
        except Exception as e:
            print(f'[piper] Error: {e}')
            self.send_json(500, {'error': str(e)})
        finally:
            if tmp_path and Path(tmp_path).exists():
                os.unlink(tmp_path)


if __name__ == '__main__':
    host = os.environ.get('PIPER_HOST', '127.0.0.1')
    port = int(os.environ.get('PIPER_PORT', '5000'))
    server = HTTPServer((host, port), Handler)
    print(f'[piper] Starting on http://{host}:{port}')
    print(f'[piper] Models directory: {Path(MODELS_DIR).resolve()}')
    server.serve_forever()
