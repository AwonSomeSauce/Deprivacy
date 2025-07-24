import os
import json
import numpy as np
from random import choice
from tqdm import tqdm
from scipy.spatial.distance import cdist


def create_clusters(embeddings, num_clusters=1, metric="euclidean", output_file=None):
    """
    Create clusters using the same algorithm as CluSanT.
    
    Args:
        embeddings: Dictionary mapping words to their embedding vectors
        num_clusters: Number of clusters to create
        metric: Distance metric for clustering (default: euclidean)
        output_file: Optional path to save clusters as JSON
    
    Returns:
        Dictionary mapping cluster indices to lists of words
    """
    clusters = {}
    words = list(embeddings.keys())
    words_per_cluster = len(words) // min(num_clusters, len(words))
    seen_words = set()

    pbar = tqdm(total=len(words), desc="Creating clusters")
    
    while words:
        # Randomly select a seed word
        w = choice(words)
        
        # Get embeddings for remaining words as numpy array for efficiency
        word_embeddings = np.array([embeddings[word] for word in words])
        seed_embedding = embeddings[w].reshape(1, -1)
        
        # Calculate distances from seed word to all remaining words
        distances = cdist(seed_embedding, word_embeddings, metric=metric)[0]
        
        # Find nearest words to form cluster
        cluster_size = min(words_per_cluster, len(words))
        nearest_indices = np.argsort(distances)[:cluster_size]
        cluster = [words[i] for i in nearest_indices]
        clusters[len(clusters)] = cluster

        # Ensure no word appears in multiple clusters
        for word in cluster:
            if word in seen_words:
                pbar.close()
                raise ValueError(f"Word '{word}' appears in multiple clusters.")
            seen_words.add(word)

        # Remove assigned words from the pool (in reverse order to maintain indices)
        for i in sorted(nearest_indices, reverse=True):
            words.pop(i)
        pbar.update(len(cluster))

    pbar.close()

    # Save clusters if output file is specified
    if output_file:
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w") as f:
            json.dump(clusters, f, indent=2)

    return clusters