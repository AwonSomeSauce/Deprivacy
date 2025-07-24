import sys
import re
import numpy as np
import os
from presidio_analyzer import AnalyzerEngine

def is_clean_word(word):
    """Check if word is clean, canonical English word suitable for PII detection"""
    # Only lowercase letters, numbers, and hyphens allowed
    if not re.match(r'^[a-z0-9-]+$', word):
        return False
    
    # Filter out very short words (1 character)
    if len(word) < 2:
        return False
    
    # Filter out words that are just numbers or hyphens
    if word.isdigit() or word == '-' or word.startswith('-') or word.endswith('-'):
        return False
    
    # Filter out words with consecutive hyphens
    if '--' in word:
        return False
    
    return True

def is_pii_entity(word, analyzer):
    """Check if word is identified as LOCATION, PERSON, or NRP by presidio_analyzer"""
    try:
        # Analyze the word with presidio
        results = analyzer.analyze(text=word, language='en')
        
        # Check if any detected entity is LOCATION, PERSON, or NRP
        target_entities = {'LOCATION', 'PERSON', 'NRP'}
        for result in results:
            if result.entity_type in target_entities:
                return True
        return False
    except Exception as e:
        # If analysis fails, skip the word
        return False

def preprocess_embeddings(input_file, output_file):
    """
    Load embeddings from input file, filter for PII entities (LOCATION, PERSON, NRP), then save to output file.
    
    Args:
        input_file: Path to original .vec file
        output_file: Path to save filtered .vec file
    """
    embeddings = {}
    seen_words = set()
    filtered_count = 0
    pii_count = 0
    total_count = 0
    
    # Initialize presidio analyzer
    print("Initializing Presidio analyzer...")
    analyzer = AnalyzerEngine()
    
    print(f"Processing embeddings from {input_file}...")
    print("Filtering for LOCATION, PERSON, and NRP entities only...")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        # Read the first line to get vocab size and dimensions
        first_line = f.readline().strip()
        vocab_size, dimensions = map(int, first_line.split())
        
        for line in f:
            total_count += 1
            if total_count % 10000 == 0:
                print(f"Processed {total_count} words, kept {len(embeddings)} PII entity words")
            
            parts = line.strip().split()
            word = parts[0]
            
            # Convert to lowercase for deduplication
            word_lower = word.lower()
            
            # Skip if we've already seen this word (case-insensitive)
            if word_lower in seen_words:
                continue
            
            # Check if word is clean and canonical first (basic filtering)
            if is_clean_word(word_lower):
                # Then check if it's a PII entity we want
                if is_pii_entity(word_lower, analyzer):
                    vector = np.array([float(x) for x in parts[1:]])
                    embeddings[word_lower] = vector
                    seen_words.add(word_lower)
                    pii_count += 1
                else:
                    filtered_count += 1
            else:
                filtered_count += 1
    
    print(f"Filtering complete:")
    print(f"  Total words processed: {total_count}")
    print(f"  PII entity words kept: {len(embeddings)} (LOCATION, PERSON, NRP only)")
    print(f"  Words filtered out: {filtered_count}")
    
    # Save PII entity embeddings to output file
    print(f"Saving PII entity embeddings to {output_file}...")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header line with new vocab size and original dimensions
        f.write(f"{len(embeddings)} {dimensions}\n")
        
        # Write PII entity words and their embeddings
        for word, vector in embeddings.items():
            vector_str = ' '.join(f"{x:.6f}" for x in vector)
            f.write(f"{word} {vector_str}\n")
    
    print(f"Preprocessing complete. PII entity embeddings saved to {output_file}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python preprocess_embeddings.py <input_vec_file> <output_vec_file>")
        print("Example: python preprocess_embeddings.py embeddings/crawl-300d-2M.vec embeddings/pii_entities_crawl-300d-2M.vec")
        print("Note: This will filter embeddings to only include words identified as LOCATION, PERSON, or NRP entities by Presidio.")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    
    # Create output directory if it doesn't exist
    output_dir = os.path.dirname(output_file)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    preprocess_embeddings(input_file, output_file)