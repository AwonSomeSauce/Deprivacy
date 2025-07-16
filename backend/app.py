from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


@app.route('/detect-pii', methods=['POST'])
def detect_pii():
  data = request.get_json().get('text', '')
  print("Found data: ", data)

  # 🔧 Dummy response for now
  response = {
      "entities": [
          {"text": "John Doe", "start": 5, "end": 13,
           "type": "PERSON", "suggestion": "[REDACTED]"},
          {"text": "123-456-7890", "start": 25, "end": 37,
              "type": "PHONE_NUMBER", "suggestion": "[PHONE]"}
      ]
  }
  return jsonify(response)


if __name__ == '__main__':
  app.run(port=5000, debug=True)
