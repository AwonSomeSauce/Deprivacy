import sys
import numpy as np
from scipy.spatial.distance import cdist
from rapidfuzz import fuzz


def load_embeddings(vec_file_path):
    """Load pre-cleaned embeddings from processed .vec file"""
    embeddings = {}
    
    print("Loading pre-cleaned embeddings...")
    with open(vec_file_path, 'r', encoding='utf-8') as f:
        next(f)  # Skip first line (contains vocab size and dimensions)
        for line in f:
            parts = line.strip().split()
            word = parts[0]
            vector = np.array([float(x) for x in parts[1:]])
            embeddings[word] = vector
    
    print(f"Loaded {len(embeddings)} clean words")
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
    vec_file_path = "embeddings/cleaned_crawl-300d-2M.vec"
    
    print(f"Loading embeddings from {vec_file_path}...")
    embeddings = load_embeddings(vec_file_path)
    
    print(f"\nFinding 20 closest words to '{target_word}'...")
    result = find_closest_words(target_word, embeddings, 20)
    
    if isinstance(result, str):
        print(result)
    else:
        print(f"\nClosest words to '{target_word}':")
        for i, (word, distance) in enumerate(result, 1):
            print(f"{i:2d}. {word:<15} (distance: {distance:.4f})")