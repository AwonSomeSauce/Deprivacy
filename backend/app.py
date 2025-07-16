from flask import Flask, request, jsonify
from flask_cors import CORS
from presidio_analyzer import AnalyzerEngine

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Initialize the Presidio analyzer
analyzer = AnalyzerEngine()


@app.route('/detect-pii', methods=['POST'])
def detect_pii():
  # Extract text from incoming JSON
  data = request.get_json().get('text', '')
  print(f"Received text for PII detection: {data}")

  # Analyze the text for PII entities
  analysis_results = analyzer.analyze(text=data, language='en')

  # Build response entities list
  entities = []
  for result in analysis_results:
    entity_text = data[result.start:result.end]
    entities.append({
        "text": entity_text,
        "start": result.start,
        "end": result.end,
        "type": result.entity_type,
        "suggestion": ""
    })

  return jsonify({"entities": entities})


if __name__ == '__main__':
  # Run Flask development server
  app.run(port=5000, debug=True)
