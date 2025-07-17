import sys
import re
import numpy as np
from scipy.spatial.distance import cdist
from rapidfuzz import fuzz

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

def load_and_filter_embeddings(vec_file_path):
    """Load embeddings and filter for clean, canonical English words"""
    embeddings = {}
    seen_words = set()
    filtered_count = 0
    total_count = 0
    
    print("Loading and filtering embeddings...")
    with open(vec_file_path, 'r', encoding='utf-8') as f:
        next(f)  # Skip first line (contains vocab size and dimensions)
        for line in f:
            total_count += 1
            if total_count % 100000 == 0:
                print(f"Processed {total_count} words, kept {len(embeddings)} clean words")
            
            parts = line.strip().split()
            word = parts[0]
            
            # Convert to lowercase for deduplication
            word_lower = word.lower()
            
            # Skip if we've already seen this word (case-insensitive)
            if word_lower in seen_words:
                continue
            
            # Check if word is clean and canonical
            if is_clean_word(word_lower):
                vector = np.array([float(x) for x in parts[1:]])
                embeddings[word_lower] = vector
                seen_words.add(word_lower)
            else:
                filtered_count += 1
    
    print(f"Filtering complete:")
    print(f"  Total words processed: {total_count}")
    print(f"  Clean words kept: {len(embeddings)}")
    print(f"  Words filtered out: {filtered_count}")
    
    return embeddings

def is_clean_suggestion(candidate, query, similarity_threshold=90):
    """
    Check if candidate word is a clean suggestion (not a typo/variation of query)
    
    Filters out candidates that are too similar to the query word to avoid
    returning variations like "bangaldesh", "bangladeshbangladesh", "bangladeshis"
    when querying for "bangladesh".
    """
    similarity = fuzz.partial_ratio(candidate, query)
    return similarity < similarity_threshold

def find_closest_words(target_word, embeddings, k=20):
    if target_word not in embeddings:
        return f"Word '{target_word}' not found in embeddings"
    
    target_vector = embeddings[target_word].reshape(1, -1)
    words = []
    vectors = []
    
    for word, vector in embeddings.items():
        if word != target_word:
            words.append(word)
            vectors.append(vector)
    
    vectors = np.array(vectors)
    distances = cdist(target_vector, vectors, metric='euclidean')[0]
    
    # Get more candidates initially to account for filtering
    closest_indices = np.argsort(distances)[:k*3]
    
    # Filter out fuzzy duplicates (typos/variations of the target word)
    clean_suggestions = []
    for i in closest_indices:
        candidate = words[i]
        if is_clean_suggestion(candidate, target_word):
            clean_suggestions.append((candidate, distances[i]))
            # Stop once we have enough clean suggestions
            if len(clean_suggestions) >= k:
                break
    
    return clean_suggestions

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python find_closest_words.py <word>")
        sys.exit(1)
    
    target_word = sys.argv[1].lower()
    vec_file_path = "embeddings/crawl-300d-2M.vec"
    
    print(f"Loading embeddings from {vec_file_path}...")
    embeddings = load_and_filter_embeddings(vec_file_path)
    
    print(f"\nFinding 20 closest words to '{target_word}'...")
    result = find_closest_words(target_word, embeddings, 20)
    
    if isinstance(result, str):
        print(result)
    else:
        print(f"\nClosest words to '{target_word}':")
        for i, (word, distance) in enumerate(result, 1):
            print(f"{i:2d}. {word:<15} (distance: {distance:.4f})")