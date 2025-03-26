from flask import Flask

def create_app():
    app = Flask(__name__)

    @app.route('/')
    def home():
        return "Hello, Docker!"

    @app.route('/health')
    def health():
        return "OK", 200

    return app
