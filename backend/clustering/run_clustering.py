import numpy as np
from cluster_creator import create_clusters


def load_embeddings(vec_file):
    """
    Load embeddings from a .vec file format.
    
    Args:
        vec_file: Path to the .vec file
        
    Returns:
        Dictionary mapping words to their embedding vectors
    """
    embeddings = {}
    
    print(f"Loading embeddings from {vec_file}...")
    
    with open(vec_file, 'r', encoding='utf-8') as f:
        # Read the first line to get vocab size and dimensions
        first_line = f.readline().strip()
        vocab_size, dimensions = map(int, first_line.split())
        print(f"Vocabulary size: {vocab_size}, Dimensions: {dimensions}")
        
        # Read embeddings
        for line_num, line in enumerate(f, 1):
            if line_num % 50000 == 0:
                print(f"Loaded {line_num} embeddings...")
                
            parts = line.strip().split()
            word = parts[0]
            vector = np.array([float(x) for x in parts[1:]])
            embeddings[word] = vector
    
    print(f"Loaded {len(embeddings)} embeddings")
    return embeddings


if __name__ == "__main__":
    # Load embeddings
    embedding_file = "../embeddings/pii_entities_crawl-300d-2M.vec"
    embeddings = load_embeddings(embedding_file)
    
    # Create clusters
    num_clusters = 9327  # Adjust as needed
    output_file = "clusters/embeddings_clusters.json"
    
    print(f"Creating {num_clusters} clusters...")
    clusters = create_clusters(
        embeddings=embeddings,
        num_clusters=num_clusters,
        metric="euclidean",
        output_file=output_file
    )
    
    print(f"Clustering complete! Created {len(clusters)} clusters")
    print(f"Results saved to: {output_file}")
    
    # Print cluster summary
    for cluster_id, words in clusters.items():
        print(f"Cluster {cluster_id}: {len(words)} words (first 5: {words[:5]})")