from flask import Flask, request, jsonify
from flask_cors import CORS
from presidio_analyzer import AnalyzerEngine
from deprivacy_replacer import DeprivacyReplacer
import re

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Initialize the Presidio analyzer and Deprivacy replacer
analyzer = AnalyzerEngine()
replacer = DeprivacyReplacer(epsilon=20.0)

print("Flask app initialized with Presidio analyzer and Deprivacy replacer")


@app.route('/deprivatize', methods=['POST'])
def deprivatize():
    """
    Main endpoint for deprivatizing text using differential privacy.
    Detects PII entities (LOCATION, PERSON, NRP) and replaces them.
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({
                "success": False,
                "error": "No text provided"
            }), 400

        original_text = data.get('text', '')
        epsilon = data.get('epsilon', 20.0)
        
        if not original_text.strip():
            return jsonify({
                "success": True,
                "processed_text": original_text,
                "entities_found": 0,
                "entities_replaced": 0
            })

        print(f"Processing text (length: {len(original_text)}) with epsilon: {epsilon}")

        # Step 1: Detect PII entities using Presidio
        analysis_results = analyzer.analyze(text=original_text, language='en')
        
        # Filter for specific entity types we want to replace
        target_entity_types = {'LOCATION', 'PERSON', 'NRP'}
        relevant_entities = [
            result for result in analysis_results 
            if result.entity_type in target_entity_types
        ]

        print(f"Found {len(relevant_entities)} relevant PII entities")

        if not relevant_entities:
            return jsonify({
                "success": True,
                "processed_text": original_text,
                "entities_found": 0,
                "entities_replaced": 0,
                "message": "No PII entities found"
            })

        # Step 2: Sort entities by position (reverse order to maintain text positions)
        relevant_entities.sort(key=lambda x: x.start, reverse=True)

        # Step 3: Replace entities one by one
        processed_text = original_text
        entities_replaced = 0
        replacement_log = []

        for entity in relevant_entities:
            entity_text = original_text[entity.start:entity.end]
            print(f"Processing {entity.entity_type}: '{entity_text}'")

            # Get replacement using differential privacy
            replacement_result = replacer.replace_word(entity_text)
            
            if replacement_result[0] is not None:  # replacement_word is not None
                replacement_word, target_cluster, selected_cluster = replacement_result
                
                # Replace the entity in the text
                processed_text = (
                    processed_text[:entity.start] + 
                    replacement_word + 
                    processed_text[entity.end:]
                )
                
                entities_replaced += 1
                cluster_info = "same cluster" if target_cluster == selected_cluster else "different cluster"
                
                replacement_log.append({
                    "original": entity_text,
                    "replacement": replacement_word,
                    "type": entity.entity_type,
                    "position": f"{entity.start}-{entity.end}",
                    "cluster_info": cluster_info,
                    "target_cluster": int(target_cluster) if target_cluster is not None else None,
                    "selected_cluster": int(selected_cluster) if selected_cluster is not None else None
                })
                
                print(f"Replaced '{entity_text}' with '{replacement_word}' ({cluster_info})")
            else:
                print(f"No replacement found for '{entity_text}'")
                replacement_log.append({
                    "original": entity_text,
                    "replacement": None,
                    "type": entity.entity_type,
                    "position": f"{entity.start}-{entity.end}",
                    "error": "No replacement found"
                })

        print(f"Replacement complete: {entities_replaced}/{len(relevant_entities)} entities replaced")

        return jsonify({
            "success": True,
            "processed_text": processed_text,
            "entities_found": len(relevant_entities),
            "entities_replaced": entities_replaced,
            "epsilon_used": epsilon,
            "replacement_log": replacement_log
        })

    except Exception as e:
        print(f"Error in deprivatize endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Processing failed: {str(e)}"
        }), 500


@app.route('/detect-pii', methods=['POST'])
def detect_pii():
    """
    Legacy endpoint for PII detection only (kept for compatibility).
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"entities": []})
            
        text = data.get('text', '')
        print(f"Received text for PII detection: {text}")

        # Analyze the text for PII entities
        analysis_results = analyzer.analyze(text=text, language='en')

        # Build response entities list
        entities = []
        for result in analysis_results:
            entity_text = text[result.start:result.end]
            entities.append({
                "text": entity_text,
                "start": result.start,
                "end": result.end,
                "type": result.entity_type,
                "suggestion": ""
            })

        return jsonify({"entities": entities})

    except Exception as e:
        print(f"Error in detect-pii endpoint: {str(e)}")
        return jsonify({"entities": []})


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "analyzer_ready": analyzer is not None,
        "replacer_ready": replacer is not None,
        "clusters_loaded": len(replacer.clusters) if replacer else 0,
        "embeddings_loaded": len(replacer.embeddings) if replacer else 0
    })


@app.route('/test-replacement', methods=['POST'])
def test_replacement():
    """Test endpoint for debugging word replacement."""
    try:
        data = request.get_json()
        if not data or 'word' not in data:
            return jsonify({
                "success": False,
                "error": "No word provided"
            }), 400

        word = data.get('word', '').strip()
        epsilon = data.get('epsilon', 20.0)
        
        if not word:
            return jsonify({
                "success": False,
                "error": "Empty word provided"
            })

        # Test replacement multiple times to show variation
        replacements = []
        for i in range(5):
            result = replacer.replace_word(word)
            if result[0] is not None:
                replacement_word, target_cluster, selected_cluster = result
                cluster_info = "same cluster" if target_cluster == selected_cluster else "different cluster"
                replacements.append({
                    "replacement": replacement_word,
                    "target_cluster": int(target_cluster) if target_cluster is not None else None,
                    "selected_cluster": int(selected_cluster) if selected_cluster is not None else None,
                    "cluster_info": cluster_info
                })
            else:
                replacements.append({
                    "replacement": None,
                    "error": "No replacement found"
                })

        return jsonify({
            "success": True,
            "original_word": word,
            "epsilon": epsilon,
            "replacements": replacements
        })

    except Exception as e:
        print(f"Error in test-replacement endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Test failed: {str(e)}"
        }), 500


if __name__ == '__main__':
    print("Starting Deprivacy Flask server...")
    print("Endpoints available:")
    print("  POST /deprivatize - Main deprivatization endpoint")
    print("  POST /detect-pii - Legacy PII detection endpoint")
    print("  GET /health - Health check")
    print("  POST /test-replacement - Test word replacement")
    
    # Run Flask development server
    app.run(port=5000, debug=True)